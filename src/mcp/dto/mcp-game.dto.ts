import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class McpPlayerDto {
  @Expose()
  _id: string;

  @Expose()
  userId: string;

  @Expose()
  nickname: string;

  @Expose()
  rating: number;
}

@Exclude()
export class McpGameDto {
  @Expose()
  _id: string;

  @Expose()
  whitePlayerId?: string;

  @Expose()
  blackPlayerId?: string;

  @Expose()
  duration: string;

  @Expose()
  fen: string;

  @Expose()
  pgn: string;

  @Expose()
  status: string;

  @Expose()
  whiteTimeRemainingMs?: number;

  @Expose()
  blackTimeRemainingMs?: number;

  @Expose()
  incrementMs: number;

  @Expose()
  lastMoveAt?: Date;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  winnerId?: string;

  @Expose()
  whiteRatingChange?: number;

  @Expose()
  blackRatingChange?: number;

  @Expose()
  @Type(() => McpPlayerDto)
  whitePlayer?: McpPlayerDto;

  @Expose()
  @Type(() => McpPlayerDto)
  blackPlayer?: McpPlayerDto;
}

@Exclude()
export class McpBoardDto {
  @Expose()
  fen: string;

  @Expose()
  board: any[][];
}

@Exclude()
export class McpGameUpdateEvent {
  @Expose()
  game: McpGameDto;

  @Expose()
  board: McpBoardDto;
}
