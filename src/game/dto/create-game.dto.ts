import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class CreateGameDto {
  @ApiProperty({ example: '2022-03-29 20:00:00' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ example: '2022-03-29 20:10:00' })
  @IsDateString()
  endsAt: string;
}
