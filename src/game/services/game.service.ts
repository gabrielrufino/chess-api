import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';

import { CreateGameDto } from '../dto/create-game.dto';
import { CreateMoveDto } from '../dto/create-move.dto';
import { UpdateGameDto } from '../dto/update-game.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Player, PlayerDocument } from 'src/player/schemas/player.schema';
import { Game, GameDocument } from '../schemas/game.schema';
import { AuthUser } from 'src/auth/interfaces/auth-user.interface';
import { GameStatusEnum } from '../enumerables/game-status.enum';
import { GameDurationEnum } from '../enumerables/game-duration.enum';
import { Chess } from 'chess.js';
import { parseGameDuration } from '../utils/time-control.util';
import { GameGateway } from '../gateways/game.gateway';
import { plainToInstance } from 'class-transformer';
import { GameDto } from '../dto/game-response.dto';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    @InjectModel(Game.name)
    private readonly gameModel: Model<GameDocument>,
    @InjectModel(Player.name)
    private readonly playerModel: Model<PlayerDocument>,
    private readonly gameGateway: GameGateway,
  ) {}

  public async create(createGameDto: CreateGameDto, authUser: AuthUser) {
    const player = await this.playerModel.findOne({
      userId: authUser.sub,
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const timeControl = parseGameDuration(createGameDto.duration);

    const gameWaitingPlayer = await this.gameModel.findOneAndUpdate(
      {
        blackPlayerId: null,
        whitePlayerId: { $ne: player._id },
        duration: createGameDto.duration,
      },
      {
        $set: {
          blackPlayerId: player._id,
          status: GameStatusEnum.IN_PROGRESS,
          lastMoveAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (gameWaitingPlayer) {
      this.broadcastGameUpdate(gameWaitingPlayer);
      return gameWaitingPlayer;
    }

    const newGame = await this.gameModel.create({
      ...createGameDto,
      whitePlayerId: player._id,
      whiteTimeRemainingMs: timeControl?.initialTimeMs,
      blackTimeRemainingMs: timeControl?.initialTimeMs,
      incrementMs: timeControl?.incrementMs || 0,
    });

    return newGame;
  }

  public getDurations() {
    const labels: Record<GameDurationEnum, string> = {
      [GameDurationEnum.Unlimited]: 'Unlimited',
      [GameDurationEnum.OneMinute]: '1 minute',
      [GameDurationEnum.ThreePlusTwo]: '3 min + 2 sec',
      [GameDurationEnum.FiveMinutes]: '5 minutes',
      [GameDurationEnum.FivePlusThree]: '5 min + 3 sec',
      [GameDurationEnum.TenMinutes]: '10 minutes',
      [GameDurationEnum.TenPlusFive]: '10 min + 5 sec',
      [GameDurationEnum.FifteenPlusTen]: '15 min + 10 sec',
    };

    return Object.values(GameDurationEnum).map((value) => ({
      value,
      label: labels[value] || value,
    }));
  }

  public async findAll() {
    const total = await this.gameModel.countDocuments();
    const data = await this.gameModel
      .find()
      .populate('whitePlayer')
      .populate('blackPlayer');

    return {
      data,
      total,
    };
  }

  public async findOne(id: string) {
    return this.gameModel
      .findById(id)
      .populate('whitePlayer')
      .populate('blackPlayer');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(id: string, updateGameDto: UpdateGameDto) {
    return `This action updates a #${id} game`;
  }

  public async getBoard(id: string) {
    const game = await this.gameModel.findById(id);
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const chess = new Chess();
    try {
      chess.load(game.fen);
    } catch {
      throw new BadRequestException('Invalid or corrupted game FEN');
    }
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

    const chess = new Chess();
    try {
      chess.load(game.fen);
    } catch {
      throw new BadRequestException('Invalid or corrupted game FEN');
    }
    return chess.moves();
  }

  public async makeMove(
    id: string,
    createMoveDto: CreateMoveDto,
    authUser: AuthUser,
  ) {
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
    // In chess.js v1, load() and loadPgn() throw on invalid input
    try {
      if (game.pgn) {
        chess.loadPgn(game.pgn);
      } else if (game.fen) {
        chess.load(game.fen);
      }
    } catch {
      throw new BadRequestException('Corrupted game state');
    }

    const turn = chess.turn(); // 'w' or 'b'
    const isWhiteTurn = turn === 'w';

    const currentPlayerId = isWhiteTurn
      ? game.whitePlayerId.toString()
      : game.blackPlayerId.toString();

    if (player._id.toString() !== currentPlayerId) {
      throw new ForbiddenException('Not your turn or you are not in this game');
    }

    const now = new Date();
    if (
      game.lastMoveAt &&
      game.whiteTimeRemainingMs !== undefined &&
      game.blackTimeRemainingMs !== undefined
    ) {
      const elapsedMs = now.getTime() - game.lastMoveAt.getTime();
      if (isWhiteTurn) {
        game.whiteTimeRemainingMs -= elapsedMs;
        if (game.whiteTimeRemainingMs <= 0) {
          game.status = GameStatusEnum.TIMEOUT;
          game.whiteTimeRemainingMs = 0;
          await game.save();
          this.broadcastGameUpdate(game);
          throw new BadRequestException('Time is up for White');
        }
        game.whiteTimeRemainingMs += game.incrementMs;
      } else {
        game.blackTimeRemainingMs -= elapsedMs;
        if (game.blackTimeRemainingMs <= 0) {
          game.status = GameStatusEnum.TIMEOUT;
          game.blackTimeRemainingMs = 0;
          await game.save();
          this.broadcastGameUpdate(game);
          throw new BadRequestException('Time is up for Black');
        }
        game.blackTimeRemainingMs += game.incrementMs;
      }
    }

    // In chess.js v1, move() throws InvalidMoveError instead of returning null
    try {
      chess.move(createMoveDto.move);
    } catch {
      throw new BadRequestException('Invalid move');
    }

    game.fen = chess.fen();
    game.pgn = chess.pgn();
    game.lastMoveAt = now;

    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        game.status = GameStatusEnum.CHECKMATE;
      } else {
        game.status = GameStatusEnum.DRAW;
      }
    }

    await game.save();

    this.broadcastGameUpdate(game);

    return game;
  }

  public async claimTimeout(id: string, authUser: AuthUser) {
    const game = await this.gameModel.findById(id);
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.status !== GameStatusEnum.IN_PROGRESS) {
      throw new BadRequestException('Game is not in progress');
    }

    if (!game.whitePlayerId || !game.blackPlayerId) {
      throw new BadRequestException('Game is not full yet');
    }

    const player = await this.playerModel.findOne({ userId: authUser.sub });
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const playerIdStr = player._id.toString();
    if (
      playerIdStr !== game.whitePlayerId.toString() &&
      playerIdStr !== game.blackPlayerId.toString()
    ) {
      throw new ForbiddenException('You are not a player in this game');
    }

    const chess = new Chess();
    try {
      if (game.pgn) {
        chess.loadPgn(game.pgn);
      } else if (game.fen) {
        chess.load(game.fen);
      }
    } catch {
      throw new BadRequestException('Corrupted game state');
    }

    const isWhiteTurn = chess.turn() === 'w';

    if (
      !game.lastMoveAt ||
      game.whiteTimeRemainingMs === undefined ||
      game.blackTimeRemainingMs === undefined
    ) {
      throw new BadRequestException('This game does not have a time control');
    }

    const elapsedMs = new Date().getTime() - game.lastMoveAt.getTime();

    if (isWhiteTurn) {
      if (game.whiteTimeRemainingMs - elapsedMs <= 0) {
        game.status = GameStatusEnum.TIMEOUT;
        game.whiteTimeRemainingMs = 0;
        await game.save();
        this.broadcastGameUpdate(game);
        return game;
      }
    } else {
      if (game.blackTimeRemainingMs - elapsedMs <= 0) {
        game.status = GameStatusEnum.TIMEOUT;
        game.blackTimeRemainingMs = 0;
        await game.save();
        this.broadcastGameUpdate(game);
        return game;
      }
    }

    throw new BadRequestException('Time is not up yet');
  }

  private broadcastGameUpdate(game: GameDocument) {
    try {
      const chess = new Chess();
      if (game.pgn) chess.loadPgn(game.pgn);
      else if (game.fen) chess.load(game.fen);

      const boardData = { fen: chess.fen(), board: chess.board() };
      this.gameGateway.emitGameUpdated(
        game._id.toString(),
        plainToInstance(GameDto, game.toJSON()),
        boardData,
      );
    } catch (err) {
      this.logger.error(
        'Failed to broadcast game update',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
