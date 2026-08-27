import {
  CreateCommentRequest,
  CreateProductRequest,
  DecreaseStockRequest,
  IncreaseStockRequest,
  ListCommentsRequest,
  ListCommentsResponse,
  ListProductsResponse,
  Product,
  Comment,
} from '@app/common';
import { COMMENT_MAX_BODY_BYTES } from '@app/common/comment-html';
import { status } from '@grpc/grpc-js';
import { CACHE_MANAGER, type Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { CommentEntity } from './entities/comment.entity';

const CATALOG_GEN_KEY = 'products:gen';
const PAGE_SIZE = 25;
const MAX_COMMENT_DEPTH = 8;

function toPage(page: number): number {
  return page > 0 ? page : 1;
}

@Injectable()
export class ProductServiceService {
  private readonly logger = new Logger(ProductServiceService.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productsRepo: Repository<ProductEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentsRepo: Repository<CommentEntity>,
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
    const safePage = toPage(page);
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

  async listComments(
    request: ListCommentsRequest,
  ): Promise<ListCommentsResponse> {
    await this.getProduct(request.productId);

    const safePage = toPage(request.page);

    const rows = await this.commentsRepo.find({
      where: { productId: request.productId },
    });

    const sortBy = this.normalizeSortBy(request.sortBy);
    const sortOrder = request.sortOrder === 'asc' ? 1 : -1;

    const children = new Map<string, CommentEntity[]>();
    const roots: CommentEntity[] = [];

    for (const row of rows) {
      if (!row.parentId) {
        roots.push(row);
        continue;
      }
      const list = children.get(row.parentId) ?? [];
      list.push(row);
      children.set(row.parentId, list);
    }

    roots.sort((a, b) => this.compareRoots(a, b, sortBy) * sortOrder);

    const total = roots.length;
    const start = (safePage - 1) * PAGE_SIZE;
    const pageRoots = roots.slice(start, start + PAGE_SIZE);

    return {
      comments: pageRoots.map((root) => this.toCommentTree(root, children, 0)),
      total,
      page: safePage,
      pageSize: PAGE_SIZE,
    };
  }

  async createComment(request: CreateCommentRequest): Promise<Comment> {
    await this.getProduct(request.productId);

    const parentId = request.parentId?.trim() || null;
    if (parentId) {
      const parent = await this.commentsRepo.findOne({
        where: { id: parentId },
      });
      if (!parent || parent.productId !== request.productId) {
        throw new RpcException({
          code: status.INVALID_ARGUMENT,
          message: 'Parent comment not found',
        });
      }
      const depth = await this.commentDepth(parent);
      if (depth >= MAX_COMMENT_DEPTH) {
        throw new RpcException({
          code: status.FAILED_PRECONDITION,
          message: `Replies are limited to ${MAX_COMMENT_DEPTH} levels`,
        });
      }
    }

    const body = request.body ?? '';
    const imageUrls = (request.imageUrls ?? [])
      .map((url) => url.trim())
      .filter(Boolean);
    if (!body.trim() && imageUrls.length === 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Comment text or an image is required',
      });
    }
    if (imageUrls.length > 5) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Comments can include at most 5 images',
      });
    }
    if (Buffer.byteLength(body, 'utf8') > COMMENT_MAX_BODY_BYTES) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Comment must be at most 100 KB',
      });
    }

    const saved = await this.commentsRepo.save(
      this.commentsRepo.create({
        productId: request.productId,
        parentId,
        userId: request.userId,
        authorName: request.authorName,
        authorEmail: request.authorEmail,
        body,
        imageUrls,
      }),
    );

    return this.toProtoComment(saved, []);
  }

  private normalizeSortBy(
    value: string,
  ): 'authorName' | 'authorEmail' | 'createdAt' {
    if (value === 'userName' || value === 'authorName') {
      return 'authorName';
    }
    if (value === 'email' || value === 'authorEmail') {
      return 'authorEmail';
    }
    return 'createdAt';
  }

  private compareRoots(
    a: CommentEntity,
    b: CommentEntity,
    sortBy: 'authorName' | 'authorEmail' | 'createdAt',
  ) {
    if (sortBy === 'createdAt') {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    return a[sortBy].localeCompare(b[sortBy], undefined, {
      sensitivity: 'base',
    });
  }

  private async commentDepth(node: CommentEntity): Promise<number> {
    let depth = 1;
    let current: CommentEntity | null = node;
    while (current?.parentId) {
      depth += 1;
      current = await this.commentsRepo.findOne({
        where: { id: current.parentId },
      });
      if (depth > MAX_COMMENT_DEPTH) {
        return depth;
      }
    }
    return depth;
  }

  private toCommentTree(
    row: CommentEntity,
    children: Map<string, CommentEntity[]>,
    depth: number,
  ): Comment {
    if (depth >= MAX_COMMENT_DEPTH) {
      return this.toProtoComment(row, []);
    }
    const replies = (children.get(row.id) ?? [])
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((child) => this.toCommentTree(child, children, depth + 1));
    return this.toProtoComment(row, replies);
  }

  private commentImageKeys(row: CommentEntity): string[] {
    const urls = (row.imageUrls ?? []).map((url) => url.trim()).filter(Boolean);
    if (urls.length) {
      return urls;
    }
    const legacy = row.imageUrl?.trim();
    return legacy ? [legacy] : [];
  }

  private toProtoComment(row: CommentEntity, replies: Comment[]): Comment {
    return {
      id: row.id,
      productId: row.productId,
      parentId: row.parentId ?? '',
      userId: row.userId,
      authorName: row.authorName,
      authorEmail: row.authorEmail,
      body: row.body,
      imageUrls: this.commentImageKeys(row),
      createdAt: row.createdAt.toISOString(),
      replies,
    };
  }
}
