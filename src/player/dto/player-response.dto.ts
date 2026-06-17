import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class PlayerDto {
  @Expose()
  @ApiProperty({ description: 'The unique identifier of the player' })
  _id: string;

  @Expose()
  @ApiProperty({
    description: 'The user identifier associated with the player',
  })
  userId: string;

  @Expose()
  @ApiProperty({ description: 'Indicates if the player is a guest' })
  isGuest: boolean;

  @Expose()
  @ApiPropertyOptional({ description: 'Deletion timestamp, if deleted' })
  deletedAt?: Date;

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
}
