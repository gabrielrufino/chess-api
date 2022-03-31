import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class CreateGameDto {
  @ApiProperty({ example: '2022-03-29 20:00:00' })
  @IsISO8601()
  startsAt: string;

  @ApiProperty({ example: '2022-03-29 20:10:00' })
  @IsISO8601()
  endsAt: string;
}
