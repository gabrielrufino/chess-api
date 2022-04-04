import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsString, Length } from 'class-validator';

export class CreatePlayerDto {
  @ApiProperty({ example: 'Bobby Fischer' })
  @IsDefined()
  @IsString()
  @Length(3)
  name: string;
}
