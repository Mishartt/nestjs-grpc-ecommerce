import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import {
  ALLOWED_IMAGE_MIMES,
  MAX_IMAGE_BYTES,
  UploadService,
} from './upload.service';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('products')
@UseGuards(AuthGuard('jwt'))
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly uploadService: UploadService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
          cb(
            new BadRequestException('Image must be JPG, PNG or GIF'),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async createProduct(
    @Body() dto: CreateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl = '';

    try {
      if (file) {
        imageUrl = await this.uploadService.saveImage(file);
      }
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'File upload failed',
      );
    }

    const product = await this.productsService.createProduct({
      ...dto,
      imageUrl,
    });

    return {
      ...product,
      imageUrl: await this.uploadService.getSignedImageUrl(product.imageUrl),
    };
  }

  @Get(':id')
  async getProduct(@Param('id') id: string) {
    const product = await this.productsService.getProduct(id);
    return {
      ...product,
      imageUrl: await this.uploadService.getSignedImageUrl(product.imageUrl),
    };
  }

  @Get()
  async listProducts(@Query('page') page?: string) {
    const parsed = Number.parseInt(page ?? '1', 10);
    const result = await this.productsService.listProducts(
      Number.isFinite(parsed) ? parsed : 1,
    );
    const products = await Promise.all(
      (result.products ?? []).map(async (p) => ({
        ...p,
        imageUrl: await this.uploadService.getSignedImageUrl(p.imageUrl),
      })),
    );
    return {
      products,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
