import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
]);

const MAX_WIDTH = 320;
const MAX_HEIGHT = 240;

const BUCKET = process.env.S3_BUCKET ?? 'products';
const PRESIGN_EXPIRES = 3600;

const s3Credentials = {
  accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
  secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
};

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);

  private readonly s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: s3Credentials,
  });

  //Public
  private readonly s3Public = new S3Client({
    endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: s3Credentials,
  });

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    } catch {
      this.logger.log(`Creating bucket "${BUCKET}"…`);
      await this.s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    }
  }

  async saveImage(file: Express.Multer.File): Promise<string> {
    if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      throw new Error(
        `Invalid image type: ${file.mimetype}. Allowed: jpg, png, gif`,
      );
    }

    const ext = this.extFromMime(file.mimetype);
    const key = `products/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    const meta = await sharp(file.buffer).metadata();
    const needsResize =
      (meta.width ?? 0) > MAX_WIDTH || (meta.height ?? 0) > MAX_HEIGHT;

    const body = needsResize
      ? await sharp(file.buffer)
          .resize(MAX_WIDTH, MAX_HEIGHT, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer()
      : file.buffer;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: file.mimetype,
      }),
    );

    this.logger.log(`Uploaded to S3: ${key}`);
    return key;
  }

  async getSignedImageUrl(key: string): Promise<string> {
    if (!key) return '';
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(this.s3Public, command, { expiresIn: PRESIGN_EXPIRES });
  }

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
    };
    return map[mime] ?? '.bin';
  }
}
