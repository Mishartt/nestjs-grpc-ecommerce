import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  CreateProductRequest,
  PRODUCT_SERVICE,
  PRODUCT_SERVICE_NAME,
  ProductServiceClient,
} from '@app/common';

@Injectable()
export class ProductsService implements OnModuleInit {
  private productClient!: ProductServiceClient;

  constructor(@Inject(PRODUCT_SERVICE) private client: ClientGrpc) {}

  onModuleInit() {
    this.productClient =
      this.client.getService<ProductServiceClient>(PRODUCT_SERVICE_NAME);
  }

  createProduct(data: CreateProductRequest) {
    return firstValueFrom(this.productClient.createProduct(data));
  }

  getProduct(id: string) {
    return firstValueFrom(this.productClient.getProduct({ id }));
  }

  listProducts(page = 1) {
    return firstValueFrom(this.productClient.listProducts({ page }));
  }
}