import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { Player, PlayerSchema } from './schemas/player.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Player.name, schema: PlayerSchema }])],
  controllers: [PlayerController],
  providers: [PlayerService],
  exports: [MongooseModule],
})
export class PlayerModule {}
