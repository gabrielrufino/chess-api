import { Injectable } from '@nestjs/common';

import { CreatePlayerDto } from './dto/create-player.dto';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Player, PlayerDocument } from './schemas/player.schema';
import { AuthUser } from 'src/auth/auth-user.interface';

@Injectable()
export class PlayerService {
  constructor(
    @InjectModel(Player.name)
    private readonly playerModel: Model<PlayerDocument>,
  ) {}

  public async create(createPlayerDto: CreatePlayerDto, authUser: AuthUser) {
    const player = await this.playerModel.create({
      ...createPlayerDto,
      userId: authUser.sub,
      isGuest: authUser.isGuest,
    });

    return player;
  }

  public async findAll() {
    const total = await this.playerModel.countDocuments();
    const players = await this.playerModel.find();

    return {
      data: players,
      total,
    };
  }

  public async findOne(id: string) {
    return this.playerModel.findById(id);
  }

  public update(id: string) {
    return `This action updates a #${id} player`;
  }

  public async remove(id: string) {
    return this.playerModel.findByIdAndUpdate(
      id,
      { deletedAt: new Date() },
      { new: true },
    );
  }
}
