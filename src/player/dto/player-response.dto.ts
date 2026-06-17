import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlayerDto {
  @ApiProperty({ description: 'The unique identifier of the player' })
  _id: string;

  @ApiProperty({
    description: 'The user identifier associated with the player',
  })
  userId: string;

  @ApiProperty({ description: 'Indicates if the player is a guest' })
  isGuest: boolean;

  @ApiPropertyOptional({ description: 'Deletion timestamp, if deleted' })
  deletedAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class PlayerListDto {
  @ApiProperty({ type: [PlayerDto], description: 'List of players' })
  data: PlayerDto[];

  @ApiProperty({ description: 'Total number of players' })
  total: number;
}
