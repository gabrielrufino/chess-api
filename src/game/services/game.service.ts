import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { Game, GameDocument } from '../schemas/game.schema';
import { Player, PlayerDocument } from '../../player/schemas/player.schema';
import { CreateGameDto } from '../dto/create-game.dto';
import { CreateMoveDto } from '../dto/create-move.dto';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { GameStatusEnum } from '../enumerables/game-status.enum';
import { GameDurationEnum } from '../enumerables/game-duration.enum';
import { Chess } from 'chess.js';
import { parseGameDuration } from '../utils/time-control.util';
import { calculateRatingChanges, GameResult } from '../utils/elo.util';
import { GameGateway } from '../gateways/game.gateway';
import { plainToInstance } from 'class-transformer';
import { GameDto, GameBoardDto } from '../dto/game-response.dto';

interface GameUpdateEvent {
  gameId: string;
  game: GameDto;
  board: GameBoardDto;
}

interface PopulatedGame extends Game {
  whitePlayer?: Player;
  blackPlayer?: Player;
  createdAt?: Date;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly gameUpdates$ = new Subject<GameUpdateEvent>();

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
      deletedAt: null,
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const timeControl = parseGameDuration(createGameDto.duration);

    const gameWaitingPlayer = await this.gameModel.findOneAndUpdate(
      {
        status: GameStatusEnum.WAITING_PLAYER,
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

  public async findAll(skip: number = 0, limit: number = 10) {
    const [total, data] = await Promise.all([
      this.gameModel.estimatedDocumentCount(),
      this.gameModel
        .find()
        .skip(skip)
        .limit(limit)
        .populate('whitePlayer')
        .populate('blackPlayer')
        .lean(),
    ]);

    return {
      data,
      total,
    };
  }

  public async findOne(id: string) {
    return this.gameModel
      .findById(id)
      .populate('whitePlayer')
      .populate('blackPlayer')
      .lean();
  }

  public async getBoard(id: string) {
    const game = await this.gameModel.findById(id).lean();
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const chess = this.loadChessGame(game);
    return {
      fen: chess.fen(),
      board: chess.board(),
    };
  }

  public async getMoves(id: string) {
    const game = await this.gameModel.findById(id).lean();
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const chess = this.loadChessGame(game);
    return chess.moves();
  }

  public async makeMove(
    id: string,
    createMoveDto: CreateMoveDto,
    authUser: AuthUser,
  ) {
    const rawGame = await this.gameModel
      .findById(id)
      .populate('whitePlayer')
      .populate('blackPlayer');
    const game = this.validateGameForMove(rawGame);

    const rawPlayer = await this.playerModel.findOne({
      userId: authUser.sub,
      deletedAt: null,
    });
    if (!rawPlayer) {
      throw new NotFoundException('Player not found');
    }
    const chess = this.loadChessGame(game);
    const isWhiteTurn = chess.turn() === 'w';

    this.validatePlayerTurn(game, rawPlayer, isWhiteTurn);

    const now = new Date();
    await this.handleTimeControl(game, isWhiteTurn, now, chess);

    this.updateGameState(game, chess, createMoveDto.move, now);

    if (game.status !== GameStatusEnum.IN_PROGRESS) {
      await this.processGameEnd(game);
    }

    await game.save();
    this.broadcastGameUpdate(game);

    return game;
  }

  private validateGameForMove(game: GameDocument | null): GameDocument {
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (!game.whitePlayerId || !game.blackPlayerId) {
      throw new BadRequestException('Game is not full yet');
    }

    if (game.status !== GameStatusEnum.IN_PROGRESS) {
      throw new BadRequestException('Game is not in progress');
    }

    return game;
  }

  private validatePlayerTurn(
    game: GameDocument,
    player: PlayerDocument,
    isWhiteTurn: boolean,
  ): void {
    const currentPlayerId = isWhiteTurn
      ? game.whitePlayerId.toString()
      : game.blackPlayerId.toString();

    if (player._id.toString() !== currentPlayerId) {
      throw new ForbiddenException('Not your turn or you are not in this game');
    }
  }

  private canPossibilyCheckmate(chess: Chess, color: 'w' | 'b'): boolean {
    const board = chess.board();
    const oppPieces: string[] = [];
    const flagPieces: string[] = [];

    for (const row of board) {
      for (const piece of row) {
        if (piece) {
          if (piece.color === color) {
            oppPieces.push(piece.type);
          } else {
            flagPieces.push(piece.type);
          }
        }
      }
    }

    // Opponent only has King
    if (oppPieces.length === 1) {
      return false;
    }

    // If opponent has King + Bishop, and flagging player has only King
    if (
      oppPieces.length === 2 &&
      oppPieces.includes('b') &&
      flagPieces.length === 1
    ) {
      return false;
    }

    // If opponent has King + Knight, and flagging player has only King
    if (
      oppPieces.length === 2 &&
      oppPieces.includes('n') &&
      flagPieces.length === 1
    ) {
      return false;
    }

    if (chess.isInsufficientMaterial()) {
      return false;
    }

    return oppPieces.some((type) => type !== 'k');
  }

  private async handleTimeControl(
    game: GameDocument,
    isWhiteTurn: boolean,
    now: Date,
    chess: Chess,
  ): Promise<void> {
    if (
      !game.lastMoveAt ||
      game.whiteTimeRemainingMs === undefined ||
      game.blackTimeRemainingMs === undefined
    ) {
      return;
    }

    const remaining = this.computeTimeRemaining(game, isWhiteTurn, now);

    if (isWhiteTurn) {
      game.whiteTimeRemainingMs = remaining;
      if (remaining <= 0) {
        game.whiteTimeRemainingMs = 0;
        const canCheckmate = this.canPossibilyCheckmate(chess, 'b');
        if (canCheckmate) {
          game.status = GameStatusEnum.TIMEOUT;
          game.winnerId = game.blackPlayerId;
        } else {
          game.status = GameStatusEnum.DRAW;
          game.winnerId = null;
        }
        await this.processGameEnd(game);
        await game.save();
        this.broadcastGameUpdate(game);
        throw new BadRequestException('Time is up for White');
      }
      game.whiteTimeRemainingMs += game.incrementMs;
    } else {
      game.blackTimeRemainingMs = remaining;
      if (remaining <= 0) {
        game.blackTimeRemainingMs = 0;
        const canCheckmate = this.canPossibilyCheckmate(chess, 'w');
        if (canCheckmate) {
          game.status = GameStatusEnum.TIMEOUT;
          game.winnerId = game.whitePlayerId;
        } else {
          game.status = GameStatusEnum.DRAW;
          game.winnerId = null;
        }
        await this.processGameEnd(game);
        await game.save();
        this.broadcastGameUpdate(game);
        throw new BadRequestException('Time is up for Black');
      }
      game.blackTimeRemainingMs += game.incrementMs;
    }
  }

  /**
   * Applies the move to the chess engine and mutates `game` in place,
   * updating fen, pgn, lastMoveAt and status (if the game ended).
   */
  private updateGameState(
    game: GameDocument,
    chess: Chess,
    move: string,
    now: Date,
  ): void {
    try {
      chess.move(move);
    } catch {
      throw new BadRequestException('Invalid move');
    }

    game.fen = chess.fen();
    game.pgn = chess.pgn();
    game.lastMoveAt = now;

    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        game.status = GameStatusEnum.CHECKMATE;
        // The player who just moved (and thus is NOT the current turn) wins
        game.winnerId =
          chess.turn() === 'w' ? game.blackPlayerId : game.whitePlayerId;
      } else {
        game.status = GameStatusEnum.DRAW;
      }
    }
  }

  public async claimTimeout(id: string, authUser: AuthUser) {
    const game = await this.gameModel
      .findById(id)
      .populate('whitePlayer')
      .populate('blackPlayer');
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.status !== GameStatusEnum.IN_PROGRESS) {
      throw new BadRequestException('Game is not in progress');
    }

    if (!game.whitePlayerId || !game.blackPlayerId) {
      throw new BadRequestException('Game is not full yet');
    }

    const player = await this.playerModel.findOne({
      userId: authUser.sub,
      deletedAt: null,
    });
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

    const chess = this.loadChessGame(game);

    const isWhiteTurn = chess.turn() === 'w';

    if (
      !game.lastMoveAt ||
      game.whiteTimeRemainingMs === undefined ||
      game.blackTimeRemainingMs === undefined
    ) {
      throw new BadRequestException('This game does not have a time control');
    }

    const now = new Date();
    const remaining = this.computeTimeRemaining(game, isWhiteTurn, now);

    if (remaining <= 0) {
      if (isWhiteTurn) {
        game.whiteTimeRemainingMs = 0;
        const canCheckmate = this.canPossibilyCheckmate(chess, 'b');
        if (canCheckmate) {
          game.status = GameStatusEnum.TIMEOUT;
          game.winnerId = game.blackPlayerId;
        } else {
          game.status = GameStatusEnum.DRAW;
          game.winnerId = null;
        }
      } else {
        game.blackTimeRemainingMs = 0;
        const canCheckmate = this.canPossibilyCheckmate(chess, 'w');
        if (canCheckmate) {
          game.status = GameStatusEnum.TIMEOUT;
          game.winnerId = game.whitePlayerId;
        } else {
          game.status = GameStatusEnum.DRAW;
          game.winnerId = null;
        }
      }
      await this.processGameEnd(game);
      await game.save();
      this.broadcastGameUpdate(game);
      return game;
    }

    throw new BadRequestException('Time is not up yet');
  }

  /**
   * Computes the remaining time (in ms) for the current player after
   * subtracting the elapsed time since the last move.
   */
  private computeTimeRemaining(
    game: GameDocument,
    isWhiteTurn: boolean,
    now: Date,
  ): number {
    const elapsedMs = now.getTime() - game.lastMoveAt.getTime();
    const currentTimeMs = isWhiteTurn
      ? game.whiteTimeRemainingMs
      : game.blackTimeRemainingMs;
    return currentTimeMs - elapsedMs;
  }

  private async processGameEnd(game: GameDocument): Promise<void> {
    if (!game.whitePlayer || !game.blackPlayer) {
      this.logger.warn(
        `Cannot process rating for game ${String(game._id)} without populated players`,
      );
      return;
    }

    if (
      game.whiteRatingChange !== undefined ||
      game.blackRatingChange !== undefined
    ) {
      return;
    }

    let session: ClientSession | null = null;
    try {
      session = await this.gameModel.db.startSession();
    } catch {
      this.logger.debug(
        'Transactions are not supported by the database, falling back to non-transactional updates.',
      );
    }

    if (session) {
      try {
        await session.withTransaction(async () => {
          const whitePlayer = await this.playerModel
            .findById(game.whitePlayerId)
            .session(session);
          const blackPlayer = await this.playerModel
            .findById(game.blackPlayerId)
            .session(session);

          const whiteRating = whitePlayer?.rating ?? 1200;
          const blackRating = blackPlayer?.rating ?? 1200;

          let result: GameResult;
          if (game.status === GameStatusEnum.DRAW) {
            result = GameResult.DRAW;
          } else if (
            game.winnerId?.toString() === game.whitePlayerId?.toString()
          ) {
            result = GameResult.WHITE_WINS;
          } else {
            result = GameResult.BLACK_WINS;
          }

          const ratingChanges = calculateRatingChanges(
            whiteRating,
            blackRating,
            result,
          );

          game.whiteRatingChange = ratingChanges.white.delta;
          game.blackRatingChange = ratingChanges.black.delta;

          await game.save({ session });

          await this.playerModel.updateOne(
            { _id: game.whitePlayerId },
            [
              {
                $set: {
                  rating: {
                    $add: [
                      { $ifNull: ['$rating', 1200] },
                      ratingChanges.white.delta,
                    ],
                  },
                },
              },
            ],
            { session, updatePipeline: true },
          );

          await this.playerModel.updateOne(
            { _id: game.blackPlayerId },
            [
              {
                $set: {
                  rating: {
                    $add: [
                      { $ifNull: ['$rating', 1200] },
                      ratingChanges.black.delta,
                    ],
                  },
                },
              },
            ],
            { session, updatePipeline: true },
          );
        });
        return;
      } catch (err) {
        const errObj = err as Record<string, unknown>;
        const isReplicaSetError =
          err instanceof Error &&
          (err.message.includes('Transaction numbers are only allowed') ||
            errObj.code === 20 ||
            errObj.codeName === 'IllegalOperation');

        if (isReplicaSetError) {
          this.logger.warn(
            'Transactions are not supported by this MongoDB topology (replica set required). Falling back to non-transactional updates.',
          );
          await session.endSession();
          session = null;
        } else {
          this.logger.error(
            'Transaction failed, rolling back',
            err instanceof Error ? err.stack : String(err),
          );
          throw err;
        }
      } finally {
        if (session) {
          await session.endSession();
        }
      }
    }

    const whiteRating = game.whitePlayer.rating || 1200;
    const blackRating = game.blackPlayer.rating || 1200;

    let result: GameResult;
    if (game.status === GameStatusEnum.DRAW) {
      result = GameResult.DRAW;
    } else if (game.winnerId?.toString() === game.whitePlayerId?.toString()) {
      result = GameResult.WHITE_WINS;
    } else {
      result = GameResult.BLACK_WINS;
    }

    const ratingChanges = calculateRatingChanges(
      whiteRating,
      blackRating,
      result,
    );

    game.whiteRatingChange = ratingChanges.white.delta;
    game.blackRatingChange = ratingChanges.black.delta;

    await game.save();

    await Promise.all([
      this.playerModel.updateOne(
        { _id: game.whitePlayerId },
        [
          {
            $set: {
              rating: {
                $add: [
                  { $ifNull: ['$rating', 1200] },
                  ratingChanges.white.delta,
                ],
              },
            },
          },
        ],
        { updatePipeline: true },
      ),
      this.playerModel.updateOne(
        { _id: game.blackPlayerId },
        [
          {
            $set: {
              rating: {
                $add: [
                  { $ifNull: ['$rating', 1200] },
                  ratingChanges.black.delta,
                ],
              },
            },
          },
        ],
        { updatePipeline: true },
      ),
    ]);
  }

  private broadcastGameUpdate(game: GameDocument) {
    try {
      const chess = this.loadChessGame(game);

      const boardData = { fen: chess.fen(), board: chess.board() };
      const gameDto = plainToInstance(
        GameDto,
        typeof game.toJSON === 'function' ? game.toJSON() : game,
      );

      this.gameGateway.emitGameUpdated(String(game._id), gameDto, boardData);

      this.gameUpdates$.next({
        gameId: String(game._id),
        game: gameDto,
        board: boardData,
      });
    } catch (err) {
      this.logger.error(
        'Failed to broadcast game update',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private isAfterSnapshot(
    event: GameUpdateEvent,
    initialGame: GameDto | null,
  ): boolean {
    if (!initialGame) return true;
    if (event.game.updatedAt && initialGame.updatedAt) {
      return (
        new Date(event.game.updatedAt).getTime() >
        new Date(initialGame.updatedAt).getTime()
      );
    }
    return (
      event.game.pgn !== initialGame.pgn ||
      event.game.status !== initialGame.status
    );
  }

  public getGameUpdates$(gameId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const buffer: GameUpdateEvent[] = [];
      let initialGame: GameDto | null = null;
      let initialLoaded = false;

      const subscription = this.gameUpdates$
        .asObservable()
        .pipe(filter((event) => event.gameId === gameId))
        .subscribe({
          next: (event: GameUpdateEvent) => {
            if (!initialLoaded) {
              buffer.push(event);
            } else {
              const isNewer = this.isAfterSnapshot(event, initialGame);

              if (isNewer) {
                subscriber.next({
                  data: { game: event.game, board: event.board },
                });
              }
            }
          },
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });

      this.findOne(gameId)
        .then((game) => {
          if (!game) {
            subscriber.error(
              new NotFoundException(`Game with ID ${gameId} not found`),
            );
            return;
          }
          const chess = this.loadChessGame(game);
          const board = { fen: chess.fen(), board: chess.board() };
          initialGame = plainToInstance(
            GameDto,
            typeof game.toJSON === 'function' ? game.toJSON() : game,
          );

          subscriber.next({
            data: {
              game: initialGame,
              board,
            },
          });

          initialLoaded = true;

          for (const event of buffer) {
            const isNewer = this.isAfterSnapshot(event, initialGame);

            if (isNewer) {
              subscriber.next({
                data: { game: event.game, board: event.board },
              });
            }
          }
          buffer.length = 0;
        })
        .catch((err) => {
          subscriber.error(err);
        });

      return () => {
        subscription.unsubscribe();
      };
    });
  }

  private loadChessGame(game: Pick<Game, 'pgn' | 'fen'>): Chess {
    const chess = new Chess();
    try {
      if (game.pgn) {
        chess.loadPgn(game.pgn);
      } else if (game.fen) {
        chess.load(game.fen);
      } else {
        throw new BadRequestException('No game state found');
      }
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      throw new BadRequestException('Invalid or corrupted game state');
    }
    return chess;
  }

  public async exportUserGamesToCsv(authUser: AuthUser): Promise<string> {
    const player = await this.playerModel.findOne({
      userId: authUser.sub,
      deletedAt: null,
    });
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const games = await this.gameModel
      .find({
        $or: [{ whitePlayerId: player._id }, { blackPlayerId: player._id }],
      })
      .populate('whitePlayer')
      .populate('blackPlayer')
      .sort({ createdAt: -1 })
      .lean<PopulatedGame[]>();

    const csvLines: string[] = ['Date,Opponent,Color,Result,PGN'];

    for (const game of games) {
      const isWhite = game.whitePlayerId?.toString() === player._id.toString();
      const rawOpponent = isWhite
        ? (game.blackPlayer?.nickname ?? 'Unknown')
        : (game.whitePlayer?.nickname ?? 'Unknown');
      const opponent = this.escapeCsvCell(rawOpponent);
      const color = isWhite ? 'White' : 'Black';
      const result = game.status;
      const date = game.createdAt ? game.createdAt.toISOString() : '';

      const pgn = this.escapeCsvCell(game.pgn || '');
      csvLines.push(`${date},${opponent},${color},${result},${pgn}`);
    }

    return csvLines.join('\n');
  }

  private escapeCsvCell(value?: string | null): string {
    const stringValue = value ?? '';
    const formulaPrefixes = ['=', '+', '-', '@', '\t', '\r'];
    const hasFormulaPrefix = formulaPrefixes.some((prefix) =>
      stringValue.startsWith(prefix),
    );
    const sanitized = hasFormulaPrefix ? `'${stringValue}` : stringValue;
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
}
