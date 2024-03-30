import { PlayerEntity } from 'src/player/entities/player.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GameDurationEnum } from '../enumerables/game-duration.enum';

@Entity('games')
export class GameEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  whitePlayerId: string | null;

  @Column({ nullable: true })
  blackPlayerId: string | null;

  @Column({ enum: GameDurationEnum })
  duration: GameDurationEnum;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => PlayerEntity)
  whitePlayer?: PlayerEntity;

  @ManyToOne(() => PlayerEntity)
  blackPlayer?: PlayerEntity;
}
