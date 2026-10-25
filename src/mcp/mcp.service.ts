import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chess } from 'chess.js';
import { plainToInstance } from 'class-transformer';
import { McpGameDto, McpBoardDto } from './dto/mcp-game.dto';
import { Game, GameDocument } from '../game/schemas/game.schema';
import { Player, PlayerDocument } from '../player/schemas/player.schema';
import { GameStatusEnum } from '../game/enumerables/game-status.enum';
import { GameDurationEnum } from '../game/enumerables/game-duration.enum';
import { parseGameDuration } from '../game/utils/time-control.util';
import { calculateRatingChanges, GameResult } from '../game/utils/elo.util';
import { GameGateway } from '../game/gateways/game.gateway';
import { GameDto } from '../game/dto/game-response.dto';

/** MCP-compliant tool result wrapper */
export interface ToolResult {
  isError: boolean;
  content: Array<{ type: string; text: string }>;
}

/** Helper to build a success response */
function ok(data: Record<string, unknown>): ToolResult {
  return {
    isError: false,
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

@Injectable()
export class GameMcpService {
  private readonly logger = new Logger(GameMcpService.name);

  constructor(
    @InjectModel(Game.name)
    private readonly gameModel: Model<GameDocument>,
    @InjectModel(Player.name)
    private readonly playerModel: Model<PlayerDocument>,
    private readonly gameGateway: GameGateway,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────

  public findGame(gameId: string): Promise<GameDocument | null> {
    return this.gameModel
      .findById(gameId)
      .populate('whitePlayer')
      .populate('blackPlayer')
      .lean()
      .then((g) => (g ? g : null));
  }

  loadChessGame(game: { pgn?: string; fen?: string }): Chess {
    const chess = new Chess();
    try {
      if (game.pgn) {
        chess.loadPgn(game.pgn);
      } else if (game.fen) {
        chess.load(game.fen);
      }
    } catch {
      chess.reset();
    }
    return chess;
  }

  private serialize(game: GameDocument): McpGameDto {
    return plainToInstance(
      McpGameDto,
      typeof game.toJSON === 'function' ? game.toJSON() : game,
    );
  }

  /** Check if pieces of given color could possibly deliver checkmate */
  private canPossiblyCheckmate(chess: Chess, color: 'w' | 'b'): boolean {
    const board = chess.board();
    const colorPieces: string[] = [];
    for (const row of board) {
      for (const piece of row) {
        if (piece && piece.color === color) {
          colorPieces.push(piece.type);
        }
      }
    }
    if (colorPieces.length <= 1) return false;
    if (
      colorPieces.length === 2 &&
      (colorPieces.includes('b') || colorPieces.includes('n'))
    ) {
      return false;
    }
    return true;
  }

  // ─── Tool handlers ──────────────────────────────────────────

  async handleCreateGame(args: Record<string, unknown>): Promise<ToolResult> {
    const playerId = args.playerId as string;
    const duration = args.duration as string;
    if (!playerId) throw new Error('"playerId" is required');
    if (!duration) throw new Error('"duration" is required');
    if (!(Object.values(GameDurationEnum) as string[]).includes(duration)) {
      throw new Error(`Invalid duration: ${duration}`);
    }

    // Try to match with waiting opponent
    const query: Record<string, unknown> = {
      status: GameStatusEnum.WAITING_PLAYER,
      blackPlayerId: null,
      whitePlayerId: { $ne: playerId },
      duration,
    };
    const update = {
      $set: {
        blackPlayerId: playerId,
        status: GameStatusEnum.IN_PROGRESS,
        lastMoveAt: new Date(),
      },
    };
    const modRes = await this.gameModel
      .findOneAndUpdate(query, update, {
        returnDocument: 'after',
      })
      .lean();

    if (modRes) {
      const chess = this.loadChessGame(modRes);
      const gameObj =
        typeof modRes.toJSON === 'function' ? modRes.toJSON() : modRes;
      const dto = plainToInstance(GameDto, gameObj);
      const mcpDto = plainToInstance(McpGameDto, gameObj);
      this.gameGateway.emitGameUpdated(String(modRes._id), dto, {
        fen: chess.fen(),
        board: chess.board(),
      });
      return ok({ game: mcpDto, matched: true });
    }

    // Check for an existing waiting game by this player to prevent duplicates
    const existingWaiting = await this.gameModel
      .findOne({
        whitePlayerId: playerId,
        status: GameStatusEnum.WAITING_PLAYER,
      })
      .lean();

    if (existingWaiting) {
      return ok({
        game: this.serialize(existingWaiting),
        matched: false,
        warning: 'Already has a waiting game',
      });
    }

    // Create new game — player is White
    const tc = parseGameDuration(duration as GameDurationEnum);
    const newGame = await this.gameModel.create({
      duration: duration as GameDurationEnum,
      whitePlayerId: playerId,
      whiteTimeRemainingMs: tc?.initialTimeMs,
      blackTimeRemainingMs: tc?.initialTimeMs,
      incrementMs: tc?.incrementMs || 0,
    });

    return ok({ game: this.serialize(newGame), matched: false });
  }

  async handleListGames(args: Record<string, unknown>): Promise<ToolResult> {
    const skip = Math.max(0, Number(args.skip) || 0);
    const limit = Math.min(100, Math.max(1, Number(args.limit) || 10));
    const [total, games] = await Promise.all([
      this.gameModel.countDocuments(),
      this.gameModel
        .find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate('whitePlayer')
        .populate('blackPlayer')
        .lean(),
    ]);
    return ok({
      games: games.map((g) => this.serialize(g)),
      total,
      skip,
      limit,
    });
  }

  async handleGetGame(args: Record<string, unknown>): Promise<ToolResult> {
    const gameId = args.gameId as string;
    if (!gameId) throw new Error('"gameId" is required');
    const game = await this.findGame(gameId);
    if (!game) throw new Error(`Game ${gameId} not found`);
    return ok({ game: this.serialize(game) });
  }

  async handleGetBoard(args: Record<string, unknown>): Promise<ToolResult> {
    const gameId = args.gameId as string;
    if (!gameId) throw new Error('"gameId" is required');
    const game = await this.findGame(gameId);
    if (!game) throw new Error(`Game ${gameId} not found`);
    const chess = this.loadChessGame(game);
    return ok({
      board: plainToInstance(McpBoardDto, {
        fen: chess.fen(),
        board: chess.board(),
      }),
      gameId,
    });
  }

  async handleMakeMove(args: Record<string, unknown>): Promise<ToolResult> {
    const gameId = args.gameId as string;
    const moveStr = args.move as string;
    const playerId = args.playerId as string;
    if (!gameId) throw new Error('"gameId" is required');
    if (!moveStr) throw new Error('"move" is required');
    if (!playerId) throw new Error('"playerId" is required');

    const raw = await this.gameModel
      .findById(gameId)
      .populate('whitePlayer')
      .populate('blackPlayer');
    if (!raw) throw new Error(`Game ${gameId} not found`);
    if (raw.status !== GameStatusEnum.IN_PROGRESS)
      throw new Error(`Game not in progress (${raw.status})`);
    if (!raw.whitePlayerId || !raw.blackPlayerId)
      throw new Error('Game is not full yet');

    const pid = String(playerId);
    const wId = String(raw.whitePlayerId);
    const bId = String(raw.blackPlayerId);
    if (pid !== wId && pid !== bId) throw new Error('You are not in this game');

    const chess = this.loadChessGame(raw);
    const isWhite = chess.turn() === 'w';
    const expectedId = isWhite ? wId : bId;
    if (pid !== expectedId)
      throw new Error(
        `Not your turn — it is ${isWhite ? 'White' : 'Black'}'s turn`,
      );

    const chessMove = chess.move(moveStr);
    if (!chessMove) throw new Error(`Invalid move: ${moveStr}`);

    // Compute elapsed time BEFORE overwriting lastMoveAt
    const prevLastMoveAt = raw.lastMoveAt;
    const elapsed = new Date().getTime() - prevLastMoveAt.getTime();

    // Update state
    raw.fen = chess.fen();
    raw.pgn = chess.pgn();
    raw.lastMoveAt = new Date();

    // Handle clocks
    if (raw.whiteTimeRemainingMs != null && raw.blackTimeRemainingMs != null) {
      const curRemains = isWhite
        ? raw.whiteTimeRemainingMs
        : raw.blackTimeRemainingMs;
      const newRem = curRemains - elapsed;
      if (isWhite) {
        raw.whiteTimeRemainingMs = newRem;
        if (newRem <= 0) {
          raw.whiteTimeRemainingMs = 0;
          this.handleTimeoutEnd(raw, chess, 'w');
        } else {
          raw.whiteTimeRemainingMs += raw.incrementMs || 0;
        }
      } else {
        raw.blackTimeRemainingMs = newRem;
        if (newRem <= 0) {
          raw.blackTimeRemainingMs = 0;
          this.handleTimeoutEnd(raw, chess, 'b');
        } else {
          raw.blackTimeRemainingMs += raw.incrementMs || 0;
        }
      }
    }

    if (chess.isGameOver()) {
      raw.status = chess.isCheckmate()
        ? GameStatusEnum.CHECKMATE
        : GameStatusEnum.DRAW;
      raw.winnerId = chess.isCheckmate()
        ? chess.turn() === 'w'
          ? raw.blackPlayerId
          : raw.whitePlayerId
        : null;
    }

    // Rating changes for ended games
    if (raw.status !== GameStatusEnum.IN_PROGRESS) {
      await this.processRatings(raw);
    }

    // Persist all state changes in a single save
    await raw.save();

    const chessAfter = this.loadChessGame(raw);
    const dto = plainToInstance(
      GameDto,
      typeof raw.toJSON === 'function' ? raw.toJSON() : raw,
    );
    this.gameGateway.emitGameUpdated(String(raw._id), dto, {
      fen: chessAfter.fen(),
      board: chessAfter.board(),
    });

    return ok({
      game: this.serialize(raw),
      move: chessMove.san,
      success: true,
      gameEnded: raw.status !== GameStatusEnum.IN_PROGRESS,
    });
  }

  private handleTimeoutEnd(
    game: GameDocument,
    chess: Chess,
    color: 'w' | 'b',
  ): void {
    const oppColor = color === 'w' ? 'b' : 'w';
    if (this.canPossiblyCheckmate(chess, oppColor)) {
      game.status = GameStatusEnum.TIMEOUT;
      game.winnerId = color === 'w' ? game.blackPlayerId : game.whitePlayerId;
    } else {
      game.status = GameStatusEnum.DRAW;
      game.winnerId = null;
    }
  }

  private async processRatings(game: GameDocument): Promise<void> {
    if (game.whiteRatingChange != null || game.blackRatingChange != null)
      return;
    if (!game.whitePlayer || !game.blackPlayer) return;

    let result: GameResult;
    if (game.status === GameStatusEnum.DRAW) result = GameResult.DRAW;
    else if (String(game.winnerId) === String(game.whitePlayerId))
      result = GameResult.WHITE_WINS;
    else result = GameResult.BLACK_WINS;

    const c = calculateRatingChanges(
      game.whitePlayer.rating,
      game.blackPlayer.rating,
      result,
    );
    game.whiteRatingChange = c.white.delta;
    game.blackRatingChange = c.black.delta;

    await Promise.all([
      this.playerModel.updateOne(
        { _id: game.whitePlayerId },
        [{ $set: { rating: { $add: ['$rating', c.white.delta] } } }],
        { updatePipeline: true },
      ),
      this.playerModel.updateOne(
        { _id: game.blackPlayerId },
        [{ $set: { rating: { $add: ['$rating', c.black.delta] } } }],
        { updatePipeline: true },
      ),
    ]);
  }

  handleGetDurations(): ToolResult {
    const labels: Record<string, string> = {
      unlimited: 'Unlimited',
      '1min': '1 minute',
      '3+2': '3 min + 2 sec',
      '5min': '5 minutes',
      '5+3': '5 min + 3 sec',
      '10min': '10 minutes',
      '10+5': '10 min + 5 sec',
      '15+10': '15 min + 10 sec',
    };
    return ok({
      durations: (Object.values(GameDurationEnum) as string[]).map((v) => ({
        value: v,
        label: labels[v] || v,
      })),
    });
  }

  async handleClaimTimeout(args: Record<string, unknown>): Promise<ToolResult> {
    const gameId = args.gameId as string;
    const playerId = args.playerId as string;
    if (!gameId) throw new Error('"gameId" is required');
    if (!playerId) throw new Error('"playerId" is required');

    const game = await this.findGame(gameId);
    if (!game) throw new Error(`Game ${gameId} not found`);
    if (game.status !== GameStatusEnum.IN_PROGRESS)
      throw new Error('Game is not in progress');
    if (!game.whitePlayerId || !game.blackPlayerId)
      throw new Error('Game is not full yet');

    if (
      !game.lastMoveAt ||
      game.whiteTimeRemainingMs == null ||
      game.blackTimeRemainingMs == null
    ) {
      throw new Error('This game does not have a time control');
    }

    const now = new Date();
    const chess = this.loadChessGame(game);
    const isWhite = chess.turn() === 'w';
    const elapsed = now.getTime() - game.lastMoveAt.getTime();
    const curRemains = isWhite
      ? game.whiteTimeRemainingMs
      : game.blackTimeRemainingMs;

    if (curRemains - elapsed > 0) {
      throw new Error(
        `${isWhite ? 'White' : 'Black'} still has ${(curRemains - elapsed) / 1000}s remaining`,
      );
    }

    if (isWhite) {
      game.whiteTimeRemainingMs = 0;
      const canBlackMate = this.canPossiblyCheckmate(chess, 'b');
      game.status = canBlackMate ? GameStatusEnum.TIMEOUT : GameStatusEnum.DRAW;
      game.winnerId = canBlackMate ? game.blackPlayerId : null;
    } else {
      game.blackTimeRemainingMs = 0;
      const canWhiteMate = this.canPossiblyCheckmate(chess, 'w');
      game.status = canWhiteMate ? GameStatusEnum.TIMEOUT : GameStatusEnum.DRAW;
      game.winnerId = canWhiteMate ? game.whitePlayerId : null;
    }

    // Rating changes for ended games
    await this.processRatings(game);

    // Persist all state changes in a single save
    await game.save();
    const dto = plainToInstance(
      GameDto,
      typeof game.toJSON === 'function' ? game.toJSON() : game,
    );
    this.gameGateway.emitGameUpdated(String(game._id), dto, {
      fen: '',
      board: [],
    });

    return ok({ game: this.serialize(game), message: 'Timeout claimed' });
  }

  async handleGetPlayerInfo(
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const userId = args.userId as string;
    if (!userId) throw new Error('"userId" is required');
    const player = await this.playerModel
      .findOne({ userId, deletedAt: null })
      .lean();
    if (!player) throw new Error(`Player not found for userId: ${userId}`);
    return ok({
      player: {
        _id: String(player._id),
        userId: player.userId,
        isGuest: player.isGuest,
        nickname: player.nickname,
        rating: player.rating,
      },
    });
  }
}
