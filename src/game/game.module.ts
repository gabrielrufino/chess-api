import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GameController } from './game.controller';
import { GameRepository } from './repositories/game.repository';
import { GameService } from './game.service';

@Module({
  imports: [TypeOrmModule.forFeature([GameRepository])],
  controllers: [GameController],
  providers: [GameService],
  exports: [TypeOrmModule],
})
export class GameModule {}
