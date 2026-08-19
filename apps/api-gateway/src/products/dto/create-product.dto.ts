import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  price!: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  stock!: number;
}