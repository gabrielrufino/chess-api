import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindAllPlayersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter players by nickname (partial, case-insensitive)',
    example: 'knight',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  nickname?: string;
}
