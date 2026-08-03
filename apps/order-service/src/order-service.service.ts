import {
  CreateOrderRequest,
  ListOrdersResponse,
  Order,
  PRODUCT_SERVICE,
  PRODUCT_SERVICE_NAME,
  ProductServiceClient,
  UpdateOrderStatusRequest,
} from '@app/common';
import { status } from '@grpc/grpc-js';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  filter,
  firstValueFrom,
  from,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
} from 'rxjs';
import { DataSource, LessThan, Repository } from 'typeorm';
import { OrderEntity, OrderItemEntity } from './entities/order.entity';

@Injectable()
export class OrderServiceService implements OnModuleInit {
  private readonly logger = new Logger(OrderServiceService.name);
  private readonly orderUpdates = new Subject<Order>();
  private productClient!: ProductServiceClient;

  constructor(
    @Inject(PRODUCT_SERVICE) private client: ClientGrpc,
    @InjectRepository(OrderEntity)
    private readonly ordersRepo: Repository<OrderEntity>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.productClient = this.client.getService<ProductServiceClient>(
      PRODUCT_SERVICE_NAME,
    );
  }

  async createOrder(data: CreateOrderRequest): Promise<Order> {
    if (!data.items.length) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Order must have at least one item',
      });
    }

    const reservedItems: { productId: string; quantity: number; price: number }[] =
      [];

    try {
      for (const item of data.items) {
        const product = await firstValueFrom(
          this.productClient.decreaseStock({
            id: item.productId,
            quantity: item.quantity,
          }),
        );

        reservedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        });
      }

      const saved = await this.dataSource.transaction(async (manager) => {
        const order = manager.create(OrderEntity, {
          userId: data.userId,
          totalAmount: reservedItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
          ),
          status: 'PENDING',
          items: reservedItems.map((item) =>
            manager.create(OrderItemEntity, item),
          ),
        });

        return manager.save(order);
      });

      const proto = this.toProto(saved);
      this.emitOrderUpdate(proto);
      return proto;
    } catch (error) {
      await Promise.all(
        reservedItems.map((item) =>
          firstValueFrom(
            this.productClient.increaseStock({
              id: item.productId,
              quantity: item.quantity,
            }),
          ).catch(() => undefined),
        ),
      );
      throw error;
    }
  }

  async getOrder(id: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id } });

    if (!order) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Order ${id} not found`,
      });
    }

    return this.toProto(order);
  }

  async listOrders(userId: string): Promise<ListOrdersResponse> {
    const orders = await this.ordersRepo.find({ where: { userId } });
    return {
      orders: orders.map((order) => this.toProto(order)),
    };
  }

  async listAllOrders(): Promise<ListOrdersResponse> {
    const orders = await this.ordersRepo.find();
    return {
      orders: orders.map((order) => this.toProto(order)),
    };
  }

  async updateOrderStatus(request: UpdateOrderStatusRequest): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id: request.id } });

    if (!order) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Order ${request.id} not found`,
      });
    }

    const result = await this.ordersRepo.update(
      { id: request.id, status: 'PENDING' },
      { status: request.status },
    );

    if (result.affected === 0) {
      throw new RpcException({
        code: status.FAILED_PRECONDITION,
        message: `Order ${request.id} is not pending`,
      });
    }

    const saved = await this.ordersRepo.findOneOrFail({
      where: { id: request.id },
    });
    const proto = this.toProto(saved);
    this.emitOrderUpdate(proto);
    return proto;
  }

  async failOrder(id: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id } });

    if (!order) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Order ${id} not found`,
      });
    }

    const result = await this.ordersRepo.update(
      { id, status: 'PENDING' },
      { status: 'FAILED' },
    );

    if (result.affected === 0) {
      throw new RpcException({
        code: status.FAILED_PRECONDITION,
        message: `Order ${id} is not pending`,
      });
    }

    await this.restoreStock(order.items);

    const saved = await this.ordersRepo.findOneOrFail({ where: { id } });
    const proto = this.toProto(saved);
    this.emitOrderUpdate(proto);
    return proto;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingOrders() {
    const minutes = Number(this.config.get('ORDER_EXPIRE_MINUTES') ?? 10);
    const threshold = new Date(Date.now() - minutes * 60_000);

    const stale = await this.ordersRepo.find({
      where: {
        status: 'PENDING',
        createdAt: LessThan(threshold),
      },
    });

    for (const order of stale) {
      try {
        const result = await this.ordersRepo.update(
          { id: order.id, status: 'PENDING' },
          { status: 'CANCELLED' },
        );

        if (result.affected === 0) {
          continue;
        }

        await this.restoreStock(order.items);

        const saved = await this.ordersRepo.findOneOrFail({
          where: { id: order.id },
        });
        this.emitOrderUpdate(this.toProto(saved));
        this.logger.log(`Expired order ${order.id}`);
      } catch (error) {
        this.logger.error(`Failed to expire order ${order.id}`, error);
      }
    }
  }

  watchOrderStatus(id: string): Observable<Order> {
    return from(this.getOrder(id)).pipe(
      switchMap((order) =>
        merge(
          of(order),
          this.orderUpdates.pipe(filter((o) => o.id === id)),
        ),
      ),
    );
  }

  private async restoreStock(items: OrderItemEntity[]) {
    await Promise.all(
      items.map((item) =>
        firstValueFrom(
          this.productClient.increaseStock({
            id: item.productId,
            quantity: item.quantity,
          }),
        ),
      ),
    );
  }

  private toProto(order: OrderEntity): Order {
    return {
      id: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
      status: order.status,
      items: (order.items ?? []).map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
    };
  }

  private emitOrderUpdate(order: Order) {
    this.orderUpdates.next({ ...order, items: [...order.items] });
  }
}
