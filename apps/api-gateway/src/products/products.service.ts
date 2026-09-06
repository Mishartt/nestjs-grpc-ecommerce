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

  deleteProduct(id: string) {
    return firstValueFrom(this.productClient.deleteProduct({ id }));
  }

  getProduct(id: string) {
    return firstValueFrom(this.productClient.getProduct({ id }));
  }

  listProducts(page = 1) {
    return firstValueFrom(this.productClient.listProducts({ page }));
  }

  listComments(
    productId: string,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
  ) {
    return firstValueFrom(
      this.productClient.listComments({
        productId,
        sortBy,
        sortOrder,
        page,
      }),
    );
  }

  createComment(data: {
    productId: string;
    parentId?: string;
    userId: string;
    authorName: string;
    authorEmail: string;
    body: string;
    imageUrls?: string[];
  }) {
    return firstValueFrom(
      this.productClient.createComment({
        productId: data.productId,
        parentId: data.parentId ?? '',
        userId: data.userId,
        authorName: data.authorName,
        authorEmail: data.authorEmail,
        body: data.body,
        imageUrls: data.imageUrls ?? [],
      }),
    );
  }
}