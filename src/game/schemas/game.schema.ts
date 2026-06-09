import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { GameDurationEnum } from '../enumerables/game-duration.enum';
import { Player } from 'src/player/schemas/player.schema';

export type GameDocument = HydratedDocument<Game>;

@Schema({ timestamps: true, collection: 'games' })
export class Game {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Player' })
  whitePlayerId?: mongoose.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Player' })
  blackPlayerId?: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: GameDurationEnum })
  duration: GameDurationEnum;
}

export const GameSchema = SchemaFactory.createForClass(Game);

GameSchema.virtual('whitePlayer', {
  ref: 'Player',
  localField: 'whitePlayerId',
  foreignField: '_id',
  justOne: true,
});

GameSchema.virtual('blackPlayer', {
  ref: 'Player',
  localField: 'blackPlayerId',
  foreignField: '_id',
  justOne: true,
});

// Ensure virtuals are included in toJSON and toObject outputs
GameSchema.set('toJSON', { virtuals: true });
GameSchema.set('toObject', { virtuals: true });
