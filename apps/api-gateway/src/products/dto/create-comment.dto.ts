import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  ValidateBy,
  buildMessage,
} from 'class-validator';
import {
  COMMENT_MAX_BODY_BYTES,
  utf8ByteLength,
} from '@app/common/comment-html';

function MaxUtf8Bytes(max: number) {
  return ValidateBy({
    name: 'maxUtf8Bytes',
    constraints: [max],
    validator: {
      validate: (value: unknown) =>
        typeof value !== 'string' || utf8ByteLength(value) <= max,
      defaultMessage: buildMessage(
        () => 'Comment must be at most 100 KB',
      ),
    },
  });
}

export class CreateCommentDto {
  @IsOptional()
  @IsString()
  @MaxUtf8Bytes(COMMENT_MAX_BODY_BYTES)
  body?: string;

  @Transform(({ value }) => (value ? String(value) : undefined))
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
