import { Controller } from '@nestjs/common';
import {
  CreateProductRequest,
  DecreaseStockRequest,
  GetProductRequest,
  IncreaseStockRequest,
  ListProductsRequest,
  ProductServiceControllerMethods,
  ProductServiceController as IProductServiceController,
} from '@app/common';
import { ProductServiceService } from './product-service.service';

@Controller()
@ProductServiceControllerMethods()
export class ProductServiceController implements IProductServiceController {
  constructor(private readonly productService: ProductServiceService) {}

  createProduct(request: CreateProductRequest) {
    return this.productService.createProduct(request);
  }

  getProduct(request: GetProductRequest) {
    return this.productService.getProduct(request.id);
  }

  listProducts(_request: ListProductsRequest) {
    return this.productService.listProducts();
  }

  decreaseStock(request: DecreaseStockRequest) {
    return this.productService.decreaseStock(request);
  }

  increaseStock(request: IncreaseStockRequest) {
    return this.productService.increaseStock(request);
  }
}
