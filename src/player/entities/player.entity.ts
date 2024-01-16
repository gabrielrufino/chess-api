import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('players')
export class PlayerEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  userId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn({ select: false })
  deletedAt: Date;
}
