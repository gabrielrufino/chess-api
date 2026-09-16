import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlayerDocument = HydratedDocument<Player>;

@Schema({ timestamps: true, collection: 'players' })
export class Player {
  @Prop({
    required: true,
    index: {
      unique: true,
      partialFilterExpression: { deletedAt: null },
    },
  })
  userId: string;

  @Prop({ required: true })
  isGuest: boolean;

  @Prop({
    required: true,
    index: {
      unique: true,
      partialFilterExpression: { deletedAt: null },
    },
  })
  nickname: string;

  @Prop()
  deletedAt?: Date;
}

export const PlayerSchema = SchemaFactory.createForClass(Player);
