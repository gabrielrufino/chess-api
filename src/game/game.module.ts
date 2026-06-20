import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlayerModule } from 'src/player/player.module';

import { GameController } from './controllers/game.controller';
import { GameService } from './services/game.service';
import { Game, GameSchema } from './schemas/game.schema';
import { GameGateway } from './gateways/game.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
    PlayerModule,
  ],
  controllers: [GameController],
  providers: [GameService, GameGateway],
  exports: [MongooseModule],
})
export class GameModule {}
