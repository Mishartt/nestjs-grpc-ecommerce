import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('products')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  description!: string;

  @Column('float')
  price!: number;

  @Column('int')
  stock!: number;

  @Column({ nullable: true, type: 'varchar' })
  imageUrl!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}