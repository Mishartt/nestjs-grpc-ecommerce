import { ORDER_SERVICE, ORDER_SERVICE_NAME, OrderServiceClient } from '@app/common';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { CreateOrderDto } from './dto/create-order.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService implements OnModuleInit {
    private orderClient!: OrderServiceClient;
    constructor(@Inject(ORDER_SERVICE) private client: ClientGrpc) {}

    onModuleInit() {
        this.orderClient = this.client.getService<OrderServiceClient>(ORDER_SERVICE_NAME);
    }
    
    async getOrders(userId: string) {
        return firstValueFrom(this.orderClient.listOrders({ userId }));
    }

    async createOrder(userId: string, createOrderDto: CreateOrderDto) {
        return firstValueFrom(
            this.orderClient.createOrder({ userId, items: createOrderDto.items }),
          );
    }
    
    async listAllOrders() {
        return firstValueFrom(
            this.orderClient.listAllOrders({}),
          );
    }

    async getOrder(id: string) {
        return firstValueFrom(this.orderClient.getOrder({ id }));
    }

    watchOrderStatus(id: string) {
        return this.orderClient.watchOrderStatus({ id });
    }
}
