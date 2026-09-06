import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  type BucketLocationConstraint,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_COMMENT_IMAGES = 5;
export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
]);

const MAX_WIDTH = 320;
const MAX_HEIGHT = 240;
const PRESIGN_EXPIRES = 3600;
const MAX_DELETE_KEYS = 1000;

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = optionalEnv(name);
  if (!raw) {
    return defaultValue;
  }
  return ['1', 'true', 'yes'].includes(raw.toLowerCase());
}

const PROVIDER = (optionalEnv('S3_PROVIDER') ?? 'minio').toLowerCase();
const IS_AWS = PROVIDER === 'aws';
const BUCKET = optionalEnv('S3_BUCKET') ?? 'products';
const REGION = optionalEnv('S3_REGION') ?? 'us-east-1';
const CUSTOM_ENDPOINT = IS_AWS
  ? undefined
  : (optionalEnv('S3_ENDPOINT') ?? 'http://localhost:9000');
const rawPublicEndpoint = optionalEnv('S3_PUBLIC_ENDPOINT');
const PUBLIC_ENDPOINT = IS_AWS
  ? rawPublicEndpoint &&
    !/localhost|127\.0\.0\.1|minio/i.test(rawPublicEndpoint)
    ? rawPublicEndpoint
    : undefined
  : (rawPublicEndpoint ?? CUSTOM_ENDPOINT);
const FORCE_PATH_STYLE = envFlag('S3_FORCE_PATH_STYLE', Boolean(CUSTOM_ENDPOINT));
const CREATE_BUCKET = envFlag('S3_CREATE_BUCKET', Boolean(CUSTOM_ENDPOINT));

function createS3Client(endpoint?: string): S3Client {
  const accessKeyId =
    optionalEnv('S3_ACCESS_KEY') ?? (IS_AWS ? undefined : 'minioadmin');
  const secretAccessKey =
    optionalEnv('S3_SECRET_KEY') ?? (IS_AWS ? undefined : 'minioadmin');

  return new S3Client({
    region: REGION,
    forcePathStyle: FORCE_PATH_STYLE,
    ...(endpoint ? { endpoint } : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });
}

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);

  private readonly s3 = createS3Client(CUSTOM_ENDPOINT);
  private readonly s3Public = createS3Client(PUBLIC_ENDPOINT);

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
      return;
    } catch {
      if (!CREATE_BUCKET) {
        this.logger.warn(
          `S3 bucket "${BUCKET}" is missing and S3_CREATE_BUCKET is off. Create it in AWS first.`,
        );
        return;
      }
    }

    this.logger.log(`Creating bucket "${BUCKET}"…`);
    await this.s3.send(
      new CreateBucketCommand({
        Bucket: BUCKET,
        ...(REGION === 'us-east-1'
          ? {}
          : {
              CreateBucketConfiguration: {
                LocationConstraint: REGION as BucketLocationConstraint,
              },
            }),
      }),
    );
  }

  async saveImage(
    file: Express.Multer.File,
    folder = 'products',
  ): Promise<string> {
    if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      throw new Error(
        `Invalid image type: ${file.mimetype}. Allowed: jpg, png, gif`,
      );
    }

    const ext = this.extFromMime(file.mimetype);
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

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

  /** Best-effort cleanup: a failed removal must not fail the caller's request. */
  async deleteImages(keys: string[]): Promise<void> {
    const unique = [...new Set(keys.filter(Boolean))];

    for (let i = 0; i < unique.length; i += MAX_DELETE_KEYS) {
      const batch = unique.slice(i, i + MAX_DELETE_KEYS);
      try {
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
          }),
        );
        this.logger.log(`Deleted from S3: ${batch.length} object(s)`);
      } catch (err) {
        this.logger.warn(
          `Failed to delete S3 objects: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
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
