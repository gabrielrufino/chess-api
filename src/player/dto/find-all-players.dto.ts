import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FindAllPlayersDto {
  @ApiPropertyOptional({
    description: 'Filter players by nickname (partial, case-insensitive)',
    example: 'knight',
  })
  @IsOptional()
  @IsString()
  nickname?: string;
}
