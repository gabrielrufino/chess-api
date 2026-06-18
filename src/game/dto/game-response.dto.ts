import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { GameDurationEnum } from '../enumerables/game-duration.enum';
import { GameStatusEnum } from '../enumerables/game-status.enum';
import { PlayerDto } from '../../player/dto/player-response.dto';

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

  @Expose()
  @Type(() => PlayerDto)
  @ApiPropertyOptional({
    type: () => PlayerDto,
    description: 'The populated white player details',
  })
  whitePlayer?: PlayerDto;

  @Expose()
  @Type(() => PlayerDto)
  @ApiPropertyOptional({
    type: () => PlayerDto,
    description: 'The populated black player details',
  })
  blackPlayer?: PlayerDto;
}

@Exclude()
export class GameListDto {
  @Expose()
  @Type(() => GameDto)
  @ApiProperty({ type: [GameDto], description: 'List of games' })
  data: GameDto[];

  @Expose()
  @ApiProperty({ description: 'Total number of games' })
  total: number;
}

@Exclude()
export class GameDurationDto {
  @Expose()
  @ApiProperty({ enum: GameDurationEnum, description: 'The duration value' })
  value: GameDurationEnum;

  @Expose()
  @ApiProperty({ description: 'The display label for the duration' })
  label: string;
}

@Exclude()
export class GameBoardDto {
  @Expose()
  @ApiProperty({ description: 'The FEN string' })
  fen: string;

  @Expose()
  @ApiProperty({
    description: 'The board representation',
    type: 'array',
    items: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
    required: false,
  })
  board: any[][];
}
