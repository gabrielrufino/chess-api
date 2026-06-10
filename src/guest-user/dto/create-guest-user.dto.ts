import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateGuestUserDto {
  @ApiProperty()
  @IsString()
  name: string;
}
