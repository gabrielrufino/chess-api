import { Player } from 'src/player/entities/player.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
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

  @Column({ name: 'white_player_id' })
  whitePlayerId: number;

  @Column({ name: 'black_player_id' })
  blackPlayerId: number;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'white_player_id' })
  whitePlayer: Player;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'black_player_id' })
  blackPlayer: Player;
}
