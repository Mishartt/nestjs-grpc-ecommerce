import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  orderId!: string;

  @Column()
  userId!: string;

  @Column('float')
  amount!: number;

  @Column()
  status!: string;
}
