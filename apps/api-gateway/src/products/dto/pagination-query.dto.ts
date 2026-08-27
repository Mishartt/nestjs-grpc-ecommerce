import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class PaginationQueryDto {
  @Transform(({ value }) => {
    const parsed = Number.parseInt(value ?? '1', 10);
    return parsed > 0 ? parsed : 1;
  })
  @IsInt()
  @Min(1)
  page = 1;
}
