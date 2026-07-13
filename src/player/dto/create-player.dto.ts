import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class CreatePlayerDto {
  @ApiProperty({
    description: 'Unique nickname for the player',
    example: 'SwiftKnight4231',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'nickname can only contain letters, numbers, underscores and hyphens',
  })
  nickname: string;
}
