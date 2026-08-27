import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('product_comments')
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  productId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column()
  userId!: string;

  @Column()
  authorName!: string;

  @Column()
  authorEmail!: string;

  @Column('text')
  body!: string;

  /** Legacy single-image column; new comments use imageUrls. */
  @Column({ type: 'varchar', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  imageUrls!: string[] | null;

  @CreateDateColumn()
  createdAt!: Date;
}
