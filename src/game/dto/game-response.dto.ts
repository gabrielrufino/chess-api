import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GameDurationEnum } from '../enumerables/game-duration.enum';
import { GameStatusEnum } from '../enumerables/game-status.enum';

export class GameDto {
  @ApiProperty({ description: 'The unique identifier of the game' })
  _id: string;

  @ApiPropertyOptional({
    description: 'The unique identifier of the white player',
  })
  whitePlayerId?: string;

  @ApiPropertyOptional({
    description: 'The unique identifier of the black player',
  })
  blackPlayerId?: string;

  @ApiProperty({
    enum: GameDurationEnum,
    description: 'The duration of the game',
  })
  duration: GameDurationEnum;

  @ApiProperty({ description: 'The FEN representation of the game state' })
  fen: string;

  @ApiProperty({ description: 'The PGN representation of the game' })
  pgn: string;

  @ApiProperty({
    enum: GameStatusEnum,
    description: 'The current status of the game',
  })
  status: GameStatusEnum;

  @ApiPropertyOptional({
    description: 'Remaining time for white player in milliseconds',
  })
  whiteTimeRemainingMs?: number;

  @ApiPropertyOptional({
    description: 'Remaining time for black player in milliseconds',
  })
  blackTimeRemainingMs?: number;

  @ApiProperty({ description: 'Time increment per move in milliseconds' })
  incrementMs: number;

  @ApiPropertyOptional({ description: 'Timestamp of the last move' })
  lastMoveAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class GameListDto {
  @ApiProperty({ type: [GameDto], description: 'List of games' })
  data: GameDto[];

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
