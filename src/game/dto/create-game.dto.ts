import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { GameDurationEnum } from '../enumerables/game-duration.enum';

export class CreateGameDto {
  @ApiProperty({ enum: GameDurationEnum })
  @IsEnum(GameDurationEnum)
  duration: GameDurationEnum;
}
