import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

class OrderItemDto {
    @IsString()
    @IsNotEmpty()
    @IsUUID()  
    productId!: string;
    @IsInt()
    @Min(1)
    quantity!: number;
}