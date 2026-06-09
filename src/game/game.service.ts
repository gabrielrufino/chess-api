import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Player, PlayerDocument } from 'src/player/schemas/player.schema';
import { Game, GameDocument } from './schemas/game.schema';
import { AuthUser } from 'src/auth/auth-user.interface';

@Injectable()
export class GameService {
  constructor(
    @InjectModel(Game.name)
    private readonly gameModel: Model<GameDocument>,
    @InjectModel(Player.name)
    private readonly playerModel: Model<PlayerDocument>,
  ) {}

  public async create(createGameDto: CreateGameDto, authUser: AuthUser) {
    const player = await this.playerModel.findOne({
      userId: authUser.sub,
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const gameWaitingPlayer = await this.gameModel.findOne({
      $or: [
        { whitePlayerId: { $exists: false } },
        { blackPlayerId: { $exists: false } },
        { whitePlayerId: null },
        { blackPlayerId: null },
      ],
      whitePlayerId: { $ne: player._id },
      blackPlayerId: { $ne: player._id },
      duration: createGameDto.duration,
    } as any);

    if (gameWaitingPlayer) {
      gameWaitingPlayer.whitePlayerId = gameWaitingPlayer.whitePlayerId || player._id as any;
      gameWaitingPlayer.blackPlayerId = gameWaitingPlayer.blackPlayerId || player._id as any;
      await gameWaitingPlayer.save();

      return gameWaitingPlayer;
    }

    const newGame = await this.gameModel.create({
      ...createGameDto,
      whitePlayerId: player._id,
    });

    return newGame;
  }

  public async findAll() {
    const total = await this.gameModel.countDocuments();
    const data = await this.gameModel.find().populate('whitePlayer').populate('blackPlayer');

    return {
      data,
      total,
    };
  }

  public async findOne(id: string) {
    return this.gameModel.findById(id).populate('whitePlayer').populate('blackPlayer');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(id: number, updateGameDto: UpdateGameDto) {
    return `This action updates a #${id} game`;
  }
}
