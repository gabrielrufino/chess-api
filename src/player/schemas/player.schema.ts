import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlayerDocument = HydratedDocument<Player>;

@Schema({ timestamps: true, collection: 'players' })
export class Player {
  @Prop({ unique: true, required: true })
  userId: string;

  @Prop({ required: true })
  isGuest: boolean;

  @Prop()
  deletedAt?: Date;
}

export const PlayerSchema = SchemaFactory.createForClass(Player);
