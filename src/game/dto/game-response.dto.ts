import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { GameDurationEnum } from '../enumerables/game-duration.enum';
import { GameStatusEnum } from '../enumerables/game-status.enum';

@Exclude()
export class GameDto {
  @Expose()
  @ApiProperty({ description: 'The unique identifier of the game' })
  _id: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'The unique identifier of the white player',
  })
  whitePlayerId?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'The unique identifier of the black player',
  })
  blackPlayerId?: string;

  @Expose()
  @ApiProperty({
    enum: GameDurationEnum,
    description: 'The duration of the game',
  })
  duration: GameDurationEnum;

  @Expose()
  @ApiProperty({ description: 'The FEN representation of the game state' })
  fen: string;

  @Expose()
  @ApiProperty({ description: 'The PGN representation of the game' })
  pgn: string;

  @Expose()
  @ApiProperty({
    enum: GameStatusEnum,
    description: 'The current status of the game',
  })
  status: GameStatusEnum;

  @Expose()
  @ApiPropertyOptional({
    description: 'Remaining time for white player in milliseconds',
  })
  whiteTimeRemainingMs?: number;

  @Expose()
  @ApiPropertyOptional({
    description: 'Remaining time for black player in milliseconds',
  })
  blackTimeRemainingMs?: number;

  @Expose()
  @ApiProperty({ description: 'Time increment per move in milliseconds' })
  incrementMs: number;

  @Expose()
  @ApiPropertyOptional({ description: 'Timestamp of the last move' })
  lastMoveAt?: Date;

  @Expose()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

@Exclude()
export class GameListDto {
  @Expose()
  @ApiProperty({ type: [GameDto], description: 'List of games' })
  data: GameDto[];

  @Expose()
  @ApiProperty({ description: 'Total number of games' })
  total: number;
}

export class GameDurationDto {
  @ApiProperty({ enum: GameDurationEnum, description: 'The duration value' })
  value: GameDurationEnum;

  @ApiProperty({ description: 'The display label for the duration' })
  label: string;
}

export class GameBoardDto {
  @ApiProperty({ description: 'The FEN string' })
  fen: string;

  @ApiProperty({
    description: 'The board representation',
    type: [Array],
    required: false,
  })
  board: any[][];
}

export class GameMoveDto {
  @ApiProperty({ description: 'The move string' })
  color: string;

  @ApiProperty({ description: 'Piece' })
  piece: string;

  @ApiProperty({ description: 'From square' })
  from: string;

  @ApiProperty({ description: 'To square' })
  to: string;

  @ApiProperty({ description: 'SAN (Standard Algebraic Notation)' })
  san: string;

  @ApiProperty({ description: 'Flags' })
  flags: string;

  @ApiProperty({ description: 'LAN (Long Algebraic Notation)' })
  lan: string;

  @ApiPropertyOptional({ description: 'Captured piece' })
  captured?: string;

  @ApiPropertyOptional({ description: 'Promoted piece' })
  promotion?: string;
}
