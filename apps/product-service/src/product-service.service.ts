import {
  CreateProductRequest,
  DecreaseStockRequest,
  IncreaseStockRequest,
  ListProductsResponse,
  Product,
} from '@app/common';
import { status } from '@grpc/grpc-js';
import { CACHE_MANAGER, type Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { ProductEntity } from './entities/product.entity';

const CATALOG_GEN_KEY = 'products:gen';
const PAGE_SIZE = 25;

@Injectable()
export class ProductServiceService {
  private readonly logger = new Logger(ProductServiceService.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productsRepo: Repository<ProductEntity>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private toProtoProduct(product: ProductEntity): Product {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      imageUrl: product.imageUrl ?? '',
    };
  }

  private async catalogKey(page: number): Promise<string> {
    const gen = (await this.cache.get<string>(CATALOG_GEN_KEY)) ?? '0';
    return `products:${gen}:page:${page}`;
  }

  private async bustCatalogCache() {
    const current = Number(
      (await this.cache.get<string>(CATALOG_GEN_KEY)) ?? '0',
    );
    await this.cache.set(CATALOG_GEN_KEY, String(current + 1));
  }

  async createProduct(data: CreateProductRequest): Promise<Product> {
    const saved = await this.productsRepo.save(
      this.productsRepo.create({
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        imageUrl: data.imageUrl || null,
      }),
    );
    await this.bustCatalogCache();
    return this.toProtoProduct(saved);
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.productsRepo.findOne({ where: { id } });

    if (!product) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Product ${id} not found`,
      });
    }

    return this.toProtoProduct(product);
  }

  async listProducts(page = 1): Promise<ListProductsResponse> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const cacheKey = await this.catalogKey(safePage);
    const cached = await this.cache.get<ListProductsResponse>(cacheKey);
    if (cached) {
      this.logger.debug(`Catalog cache hit ${cacheKey}`);
      return cached;
    }

    const [products, total] = await this.productsRepo.findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    const result: ListProductsResponse = {
      products: products.map((product) => this.toProtoProduct(product)),
      total,
      page: safePage,
      pageSize: PAGE_SIZE,
    };

    await this.cache.set(cacheKey, result);
    this.logger.debug(`Catalog cache miss ${cacheKey}`);
    return result;
  }

  async decreaseStock(request: DecreaseStockRequest): Promise<Product> {
    if (request.quantity <= 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'quantity must be positive',
      });
    }

    const update = await this.productsRepo
      .createQueryBuilder()
      .update(ProductEntity)
      .set({ stock: () => 'stock - :quantity' })
      .where('id = :id AND stock >= :quantity', {
        id: request.id,
        quantity: request.quantity,
      })
      .execute();

    if (update.affected === 0) {
      await this.getProduct(request.id);
      throw new RpcException({
        code: status.FAILED_PRECONDITION,
        message: `Not enough stock for product ${request.id}`,
      });
    }

    await this.bustCatalogCache();
    return this.getProduct(request.id);
  }

  async increaseStock(request: IncreaseStockRequest): Promise<Product> {
    if (request.quantity <= 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'quantity must be positive',
      });
    }

    const update = await this.productsRepo
      .createQueryBuilder()
      .update(ProductEntity)
      .set({ stock: () => 'stock + :quantity' })
      .where('id = :id', {
        id: request.id,
        quantity: request.quantity,
      })
      .execute();

    if (update.affected === 0) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Product ${request.id} not found`,
      });
    }

    await this.bustCatalogCache();
    return this.getProduct(request.id);
  }
}
