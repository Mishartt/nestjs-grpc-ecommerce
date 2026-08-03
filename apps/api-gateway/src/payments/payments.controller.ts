import { UserRole } from '@app/common/constants/roles';
import {
  Controller,
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
import { PaymentsService } from './payments.service';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders/:id/pay')
  async pay(@Param('id') orderId: string, @Req() req: { user: { id: string } }) {
    return this.paymentsService.pay(orderId, req.user.id);
  }

  @Get('payments')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async listAllPayments() {
    return this.paymentsService.listAllPayments();
  }

  @Get('payments/stream')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  watchPayments(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sub = this.paymentsService.watchPayments().subscribe({
      next: (payment) => {
        res.write(`data: ${JSON.stringify(payment)}\n\n`);
      },
      error: () => res.end(),
      complete: () => res.end(),
    });

    res.on('close', () => sub.unsubscribe());
  }
}