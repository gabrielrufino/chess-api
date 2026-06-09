import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

import { CreateGameDto } from './dto/create-game.dto';
import { CreateMoveDto } from './dto/create-move.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Player, PlayerDocument } from 'src/player/schemas/player.schema';
import { Game, GameDocument } from './schemas/game.schema';
import { AuthUser } from 'src/auth/auth-user.interface';
import { GameStatusEnum } from './enumerables/game-status.enum';
import { Chess } from 'chess.js';

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
      gameWaitingPlayer.status = GameStatusEnum.IN_PROGRESS;
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

  public async getBoard(id: string) {
    const game = await this.gameModel.findById(id);
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const chess = new Chess(game.fen);
    return {
      fen: chess.fen(),
      board: chess.board(),
    };
  }

  public async getMoves(id: string) {
    const game = await this.gameModel.findById(id);
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const chess = new Chess(game.fen);
    return chess.moves();
  }

  public async makeMove(id: string, createMoveDto: CreateMoveDto, authUser: AuthUser) {
    const game = await this.gameModel.findById(id);
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (!game.whitePlayerId || !game.blackPlayerId) {
      throw new BadRequestException('Game is not full yet');
    }

    if (game.status !== GameStatusEnum.IN_PROGRESS) {
      throw new BadRequestException('Game is not in progress');
    }

    const player = await this.playerModel.findOne({ userId: authUser.sub });
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const chess = new Chess();
    if (game.fen) {
      chess.load(game.fen);
    }
    if (game.pgn) {
      chess.load_pgn(game.pgn);
    }

    const turn = chess.turn(); // 'w' or 'b'
    const isWhiteTurn = turn === 'w';

    const currentPlayerId = isWhiteTurn ? game.whitePlayerId.toString() : game.blackPlayerId.toString();

    if (player._id.toString() !== currentPlayerId) {
      throw new ForbiddenException('Not your turn or you are not in this game');
    }

    const moveResult = chess.move(createMoveDto.move);
    if (!moveResult) {
      throw new BadRequestException('Invalid move');
    }

    game.fen = chess.fen();
    game.pgn = chess.pgn();

    if (chess.game_over()) {
      if (chess.in_checkmate()) {
        game.status = GameStatusEnum.CHECKMATE;
      } else {
        game.status = GameStatusEnum.DRAW;
      }
    }

    await game.save();

    return game;
  }
}
