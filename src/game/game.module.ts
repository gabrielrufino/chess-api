import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlayerModule } from 'src/player/player.module';

import { GameController } from './game.controller';
import { GameService } from './game.service';
import { Game, GameSchema } from './schemas/game.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]), PlayerModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [MongooseModule],
})
export class GameModule {}
