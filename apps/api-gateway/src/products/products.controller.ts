import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('products')
@UseGuards(AuthGuard('jwt'))
export class ProductsController {
    constructor(private readonly productsService: ProductsService) {}

    @Post()
    createProduct(@Body() dto: CreateProductDto) {
        return this.productsService.createProduct(dto);
    }

    @Get(':id')
    getProduct(@Param('id') id: string) {
        return this.productsService.getProduct(id);
    }

    @Get()
    listProducts() {
        return this.productsService.listProducts();
    }
}