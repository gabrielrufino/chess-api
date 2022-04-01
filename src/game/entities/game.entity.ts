import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'starts_at' })
  startsAt: Date;

  @Column({ name: 'ends_at' })
  endsAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
