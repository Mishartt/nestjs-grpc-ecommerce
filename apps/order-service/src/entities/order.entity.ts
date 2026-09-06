import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Human-facing number, e.g. ORD-A7K2M9QX. Null only for pre-migration rows. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16, nullable: true })
  publicId!: string | null;

  @Column()
  userId!: string;

  @Column('float')
  totalAmount!: number;

  @Column()
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => OrderItemEntity, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items!: OrderItemEntity[];
}

@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  productId!: string;

  @Column({ default: '' })
  productName!: string;

  @Column('int')
  quantity!: number;

  @Column('float')
  price!: number;

  @ManyToOne(() => OrderEntity, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  order!: OrderEntity;
}
