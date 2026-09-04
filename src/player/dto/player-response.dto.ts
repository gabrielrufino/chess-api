import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type, Transform } from 'class-transformer';

@Exclude()
export class PlayerDto {
  @Expose()
  @Transform(({ value }) => value?.toString())
  @ApiProperty({ description: 'The unique identifier of the player' })
  _id: string;

  @Expose()
  @ApiProperty({ description: 'The user identifier associated with the player' })
  userId: string;

  @Expose()
  @ApiProperty({ description: 'Indicates if the player is a guest' })
  isGuest: boolean;

  @Expose()
  @ApiProperty({ description: 'The unique nickname of the player' })
  nickname: string;

  @Expose()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

@Exclude()
export class PlayerListDto {
  @Expose()
  @Type(() => PlayerDto)
  @ApiProperty({ type: [PlayerDto], description: 'List of players' })
  data: PlayerDto[];

  @Expose()
  @ApiProperty({ description: 'Total number of players' })
  total: number;

  @Expose()
  @ApiProperty({ description: 'The number of items to skip' })
  skip: number;

  @Expose()
  @ApiProperty({ description: 'The number of items to return' })
  limit: number;
}

@Exclude()
export class NicknameSuggestionDto {
  @Expose()
  @ApiProperty({ description: 'A suggested available nickname' })
  nickname: string;
}
