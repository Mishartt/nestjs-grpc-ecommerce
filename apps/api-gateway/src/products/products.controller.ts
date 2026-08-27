import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import {
  ALLOWED_IMAGE_MIMES,
  MAX_COMMENT_IMAGES,
  MAX_IMAGE_BYTES,
  UploadService,
} from './upload.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CommentHtmlError, sanitizeCommentHtml } from '@app/common/comment-html';

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

  @Get()
  async listProducts(@Query() query: PaginationQueryDto) {
    const result = await this.productsService.listProducts(query.page);
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

  @Get(':id/comments')
  async listComments(
    @Param('id') id: string,
    @Query() query: ListCommentsQueryDto,
  ) {
    const result = await this.productsService.listComments(
      id,
      query.sort,
      query.order,
      query.page,
    );
    return {
      comments: await Promise.all(
        (result.comments ?? []).map((comment) => this.signCommentImages(comment)),
      ),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  @Post(':id/comments')
  @UseInterceptors(
    FilesInterceptor('image', MAX_COMMENT_IMAGES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_COMMENT_IMAGES },
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
  async createComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @Req() req: { user: { id: string; email: string } },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    let html = '';
    try {
      if (dto.body?.trim()) {
        html = sanitizeCommentHtml(dto.body);
      }
    } catch (err) {
      throw new BadRequestException(
        err instanceof CommentHtmlError ? err.message : 'Invalid comment HTML',
      );
    }

    const uploads = files ?? [];
    if (uploads.length > MAX_COMMENT_IMAGES) {
      throw new BadRequestException(
        `Comments can include at most ${MAX_COMMENT_IMAGES} images`,
      );
    }

    let imageUrls: string[] = [];
    try {
      imageUrls = await Promise.all(
        uploads.map((file) => this.uploadService.saveImage(file, 'comments')),
      );
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'File upload failed',
      );
    }

    if (!html && imageUrls.length === 0) {
      throw new BadRequestException('Comment text or an image is required');
    }

    const email = req.user.email;
    const comment = await this.productsService.createComment({
      productId: id,
      parentId: dto.parentId,
      userId: req.user.id,
      authorName: email.split('@')[0] || email,
      authorEmail: email,
      body: html,
      imageUrls,
    });
    return this.signCommentImages(comment);
  }

  @Get(':id')
  async getProduct(@Param('id') id: string) {
    const product = await this.productsService.getProduct(id);
    return {
      ...product,
      imageUrl: await this.uploadService.getSignedImageUrl(product.imageUrl),
    };
  }

  private async signCommentImages(comment: {
    imageUrls?: string[];
    replies?: Array<{ imageUrls?: string[]; replies?: unknown[] }>;
  }) {
    return {
      ...comment,
      imageUrls: await Promise.all(
        (comment.imageUrls ?? []).map((key) =>
          this.uploadService.getSignedImageUrl(key),
        ),
      ),
      replies: await Promise.all(
        (comment.replies ?? []).map((reply) =>
          this.signCommentImages(reply as typeof comment),
        ),
      ),
    };
  }
}
