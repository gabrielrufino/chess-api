import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { GameDurationEnum } from '../enumerables/game-duration.enum';
import { GameStatusEnum } from '../enumerables/game-status.enum';

export type GameDocument = HydratedDocument<Game>;

@Schema({ timestamps: true, collection: 'games' })
export class Game {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Player' })
  whitePlayerId?: mongoose.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Player' })
  blackPlayerId?: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: GameDurationEnum })
  duration: GameDurationEnum;

  @Prop({ default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' })
  fen: string;

  @Prop({ default: '' })
  pgn: string;

  @Prop({ default: GameStatusEnum.WAITING_PLAYER, enum: GameStatusEnum })
  status: GameStatusEnum;

  @Prop({ required: false })
  whiteTimeRemainingMs?: number;

  @Prop({ required: false })
  blackTimeRemainingMs?: number;

  @Prop({ default: 0 })
  incrementMs: number;

  @Prop({ required: false })
  lastMoveAt?: Date;
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
