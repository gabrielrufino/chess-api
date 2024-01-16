import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerModule } from 'src/player/player.module';

import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameEntity } from './entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GameEntity]), PlayerModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [TypeOrmModule],
})
export class GameModule {}
