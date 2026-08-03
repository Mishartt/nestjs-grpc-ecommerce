import { UserRole } from '@app/common/constants/roles';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrdersController {
  constructor(private readonly orderService: OrdersService) {}

  @Get()
  async getOrders(@Req() req: { user: { id: string } }) {
    return this.orderService.getOrders(req.user.id);
  }

  @Post()
  async createOrder(
    @Req() req: { user: { id: string } },
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.orderService.createOrder(req.user.id, createOrderDto);
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async getAllOrders() {
    return this.orderService.listAllOrders();
  }

  @Get(':id')
  async getOrder(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role: string } },
  ) {
    const order = await this.orderService.getOrder(id);

    if (
      order.userId !== req.user.id &&
      req.user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('You can only view your own orders');
    }

    return order;
  }
  
  @Get(':id/status/stream')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  watchOrderStatus(@Param('id') id: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sub = this.orderService.watchOrderStatus(id).subscribe({
      next: (order) => {
        res.write(`data: ${JSON.stringify(order)}\n\n`);
      },
      error: () => res.end(),
      complete: () => res.end(),
    });

    res.on('close', () => sub.unsubscribe());
  }
}
