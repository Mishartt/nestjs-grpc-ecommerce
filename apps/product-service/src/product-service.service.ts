import {
  CreateProductRequest,
  DecreaseStockRequest,
  IncreaseStockRequest,
  ListProductsResponse,
  Product,
} from '@app/common';
import { status } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { ProductEntity } from './entities/product.entity';

@Injectable()
export class ProductServiceService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productsRepo: Repository<ProductEntity>,
  ) {}

  private toProtoProduct(product: ProductEntity): Product {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
    };
  }

  async createProduct(data: CreateProductRequest): Promise<Product> {
    const saved = await this.productsRepo.save(
      this.productsRepo.create(data),
    );
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

  async listProducts(): Promise<ListProductsResponse> {
    const products = await this.productsRepo.find();
    return {
      products: products.map((product) => this.toProtoProduct(product)),
    };
  }

  async decreaseStock(request: DecreaseStockRequest): Promise<Product> {
    if (request.quantity <= 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'quantity must be positive',
      });
    }

    const result = await this.productsRepo
      .createQueryBuilder()
      .update(ProductEntity)
      .set({ stock: () => 'stock - :quantity' })
      .where('id = :id AND stock >= :quantity', {
        id: request.id,
        quantity: request.quantity,
      })
      .execute();

    if (result.affected === 0) {
      await this.getProduct(request.id);
      throw new RpcException({
        code: status.FAILED_PRECONDITION,
        message: `Not enough stock for product ${request.id}`,
      });
    }

    return this.getProduct(request.id);
  }

  async increaseStock(request: IncreaseStockRequest): Promise<Product> {
    if (request.quantity <= 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'quantity must be positive',
      });
    }

    const result = await this.productsRepo
      .createQueryBuilder()
      .update(ProductEntity)
      .set({ stock: () => 'stock + :quantity' })
      .where('id = :id', {
        id: request.id,
        quantity: request.quantity,
      })
      .execute();

    if (result.affected === 0) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Product ${request.id} not found`,
      });
    }

    return this.getProduct(request.id);
  }
}
