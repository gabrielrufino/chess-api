import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerModule } from 'src/player/player.module';

import { GameController } from './game.controller';
import { GameRepository } from './repositories/game.repository';
import { GameService } from './game.service';

@Module({
  imports: [TypeOrmModule.forFeature([GameRepository]), PlayerModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [TypeOrmModule],
})
export class GameModule {}
