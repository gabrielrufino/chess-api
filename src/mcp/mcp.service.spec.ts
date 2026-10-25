/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameMcpService } from './mcp.service';
import { Game, GameDocument } from '../game/schemas/game.schema';
import { Player, PlayerDocument } from '../player/schemas/player.schema';
import { GameStatusEnum } from '../game/enumerables/game-status.enum';
import { GameDurationEnum } from '../game/enumerables/game-duration.enum';
import { Chess } from 'chess.js';
import { GameGateway } from '../game/gateways/game.gateway';

describe(GameMcpService.name, () => {
  let service: GameMcpService;
  let gameModel: Model<GameDocument>;
  let playerModel: Model<PlayerDocument>;

  const baseMock = {
    pgn: '',
    fen: new Chess().fen(),
    toJSON: () => ({}),
  };

  beforeEach(async () => {
    gameModel = {
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
    } as unknown as Model<GameDocument>;

    playerModel = {
      findOne: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({}),
    } as unknown as Model<PlayerDocument>;

    // Stub findOne to support .lean() (used in handleCreateGame's duplicate check)
    jest.spyOn(gameModel, 'findOne').mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameMcpService,
        { provide: getModelToken(Game.name), useValue: gameModel },
        { provide: getModelToken(Player.name), useValue: playerModel },
        { provide: GameGateway, useValue: { emitGameUpdated: jest.fn() } },
      ],
    }).compile();

    service = module.get<GameMcpService>(GameMcpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findGame ──────────────────────────────────────────────────

  describe(GameMcpService.prototype.findGame.name, () => {
    function makeFindGameChain(resolvedValue: unknown): any {
      const chain = {
        populate: jest.fn(),
        lean: jest.fn().mockResolvedValue(resolvedValue),
      };
      const prevPopulate = jest.fn();
      prevPopulate.mockReturnValue(chain);
      chain.populate = prevPopulate;
      return chain;
    }

    it('should return a populated game when found', async () => {
      const mockGame = {
        ...baseMock,
        _id: { toString: () => 'game1' },
        toJSON: () => ({ id: 'game1' }),
      };
      jest
        .spyOn(gameModel, 'findById')
        .mockReturnValue(makeFindGameChain(mockGame));

      const result = await service.findGame('game1');
      expect(result).toEqual(mockGame);
    });

    it('should return null when game not found', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockReturnValue(makeFindGameChain(null));

      expect(await service.findGame('nonexistent')).toBeNull();
    });
  });

  // ─── loadChessGame ─────────────────────────────────────────────

  describe(GameMcpService.prototype.loadChessGame.name, () => {
    it('should load from PGN', () => {
      expect(service.loadChessGame({ pgn: 'e4' }).turn()).toBe('b');
    });

    it('should load from FEN', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      expect(service.loadChessGame({ fen }).fen()).toBe(fen);
    });

    it('should reset on invalid PGN', () => {
      expect(service.loadChessGame({ pgn: 'invalid pgnsadasd' }).fen()).toBe(
        new Chess().fen(),
      );
    });

    it('should reset on invalid FEN', () => {
      expect(service.loadChessGame({ fen: 'invalid-fen!!!' }).fen()).toBe(
        new Chess().fen(),
      );
    });

    it('should prefer PGN over FEN when both are provided', () => {
      const result = service.loadChessGame({
        pgn: 'e4',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      });
      expect(result.turn()).toBe('b');
    });
  });

  // ─── handleCreateGame ──────────────────────────────────────────

  describe(GameMcpService.prototype.handleCreateGame.name, () => {
    const mockPlayerId = 'player1';
    const duration = GameDurationEnum.FiveMinutes;

    const makeUpdateChain = (val: unknown): any => {
      const ret: any = {};
      ret.lean = jest.fn().mockResolvedValue(val);
      return ret;
    };

    it('should throw error when playerId is missing', async () => {
      await expect(service.handleCreateGame({ duration })).rejects.toThrow(
        '"playerId" is required',
      );
    });

    it('should throw error when duration is missing', async () => {
      await expect(
        service.handleCreateGame({ playerId: mockPlayerId }),
      ).rejects.toThrow('"duration" is required');
    });

    it('should throw error when duration is invalid', async () => {
      await expect(
        service.handleCreateGame({ playerId: mockPlayerId, duration: 'bad' }),
      ).rejects.toThrow('Invalid duration');
    });

    it('should match with a waiting opponent', async () => {
      const mockWaitingGame = {
        ...baseMock,
        _id: { toString: () => 'g1' },
        toJSON: () => ({}),
      };
      jest
        .spyOn(gameModel, 'findOneAndUpdate')
        .mockReturnValue(makeUpdateChain(mockWaitingGame));
      jest
        .spyOn(gameModel, 'findOne')
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as any);

      const result = await service.handleCreateGame({
        playerId: mockPlayerId,
        duration,
      });
      expect(JSON.parse(result.content[0].text).matched).toBe(true);
    });

    it('should match a waiting opponent without a toJSON method', async () => {
      const mockWaitingGame = {
        _id: { toString: () => 'g1' },
        pgn: '',
        fen: new Chess().fen(),
      };
      jest
        .spyOn(gameModel, 'findOneAndUpdate')
        .mockReturnValue(makeUpdateChain(mockWaitingGame));
      jest
        .spyOn(gameModel, 'findOne')
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as any);

      const result = await service.handleCreateGame({
        playerId: mockPlayerId,
        duration,
      });

      expect(JSON.parse(result.content[0].text).matched).toBe(true);
    });

    it('should warn about existing waiting game', async () => {
      jest
        .spyOn(gameModel, 'findOneAndUpdate')
        .mockReturnValue(makeUpdateChain(null));
      jest.spyOn(gameModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'existing',
          pgn: '',
          fen: '',
          toJSON: () => ({}),
        }),
      } as any);

      const result = await service.handleCreateGame({
        playerId: mockPlayerId,
        duration,
      });
      expect(JSON.parse(result.content[0].text).warning).toBe(
        'Already has a waiting game',
      );
    });

    it('should create a new game', async () => {
      jest
        .spyOn(gameModel, 'findOneAndUpdate')
        .mockReturnValue(makeUpdateChain(null));
      jest
        .spyOn(gameModel, 'findOne')
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as any);
      jest.spyOn(gameModel, 'create').mockResolvedValue({
        _id: { toString: () => 'new-g' },
        toJSON: () => ({ id: 'new-g', _id: 'new-g' }),
      } as any);

      const result = await service.handleCreateGame({
        playerId: mockPlayerId,
        duration,
      });
      expect(JSON.parse(result.content[0].text).game._id).toBe('new-g');
    });

    it('should create game with incrementMs 0 for unlimited', async () => {
      jest
        .spyOn(gameModel, 'findOneAndUpdate')
        .mockReturnValue(makeUpdateChain(null));
      jest
        .spyOn(gameModel, 'findOne')
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as any);
      jest.spyOn(gameModel, 'create').mockResolvedValue({
        _id: 'g1',
        duration: GameDurationEnum.Unlimited,
        toJSON: () => ({}),
      } as any);

      await service.handleCreateGame({
        playerId: mockPlayerId,
        duration: GameDurationEnum.Unlimited,
      });

      expect(gameModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ incrementMs: 0 }),
      );
    });
  });

  // ─── handleListGames ───────────────────────────────────────────

  describe(GameMcpService.prototype.handleListGames.name, () => {
    const makeListChain = (games: unknown[]): any => {
      const ret: any = {};
      ret.skip = jest.fn().mockReturnThis();
      ret.limit = jest.fn().mockReturnThis();
      ret.sort = jest.fn().mockReturnThis();
      ret.populate = jest.fn().mockReturnThis();
      ret.populate = jest.fn().mockReturnThis();
      ret.lean = jest.fn().mockResolvedValue(games);
      return ret;
    };

    it('should return paginated games', async () => {
      const mockGames = [
        { _id: '1', toJSON: () => ({}) },
        { _id: '2', toJSON: () => ({}) },
      ];
      jest.spyOn(gameModel, 'countDocuments').mockResolvedValue(2);
      jest.spyOn(gameModel, 'find').mockReturnValue(makeListChain(mockGames));

      const result = await service.handleListGames({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(2);
      expect(parsed.games.length).toBe(2);
    });

    it('should respect custom skip and limit', async () => {
      jest.spyOn(gameModel, 'countDocuments').mockResolvedValue(50);
      jest.spyOn(gameModel, 'find').mockReturnValue(makeListChain([]));

      const result = await service.handleListGames({ skip: 20, limit: 5 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.skip).toBe(20);
      expect(parsed.limit).toBe(5);
    });

    it('should cap limit at 100', async () => {
      jest.spyOn(gameModel, 'find').mockReturnValue(makeListChain([]));
      jest.spyOn(gameModel, 'countDocuments').mockResolvedValue(0);

      await service.handleListGames({ limit: 200 });
    });

    it('should clamp negative skip to 0', async () => {
      jest.spyOn(gameModel, 'find').mockReturnValue(makeListChain([]));
      jest.spyOn(gameModel, 'countDocuments').mockResolvedValue(0);

      await service.handleListGames({ skip: -5 });
    });
  });

  // ─── handleGetGame ─────────────────────────────────────────────

  describe(GameMcpService.prototype.handleGetGame.name, () => {
    it('should throw error when gameId is missing', async () => {
      await expect(service.handleGetGame({})).rejects.toThrow(
        '"gameId" is required',
      );
    });

    it('should throw error when game not found', async () => {
      jest.spyOn(service, 'findGame').mockResolvedValue(null);
      await expect(service.handleGetGame({ gameId: 'noid' })).rejects.toThrow(
        'Game noid not found',
      );
    });

    it('should return game data when found', async () => {
      jest
        .spyOn(service, 'findGame')
        .mockResolvedValue({ _id: 'g1', toJSON: () => ({ _id: 'g1' }) } as any);
      const result = await service.handleGetGame({ gameId: 'g1' });
      expect(JSON.parse(result.content[0].text).game._id).toBe('g1');
    });
  });

  // ─── handleGetBoard ────────────────────────────────────────────

  describe(GameMcpService.prototype.handleGetBoard.name, () => {
    it('should throw error when gameId is missing', async () => {
      await expect(service.handleGetBoard({})).rejects.toThrow(
        '"gameId" is required',
      );
    });

    it('should throw error when game not found', async () => {
      jest.spyOn(service, 'findGame').mockResolvedValue(null);
      await expect(service.handleGetBoard({ gameId: 'nope' })).rejects.toThrow(
        'Game nope not found',
      );
    });

    it('should return board with fen and board array', async () => {
      jest.spyOn(service, 'findGame').mockResolvedValue({
        _id: 'g1',
        fen: new Chess().fen(),
        pgn: '',
        toJSON: () => ({}),
      } as any);
      const result = await service.handleGetBoard({ gameId: 'g1' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.board).toHaveProperty('fen');
      expect(parsed.board).toHaveProperty('board');
    });
  });

  // ─── handleMakeMove ────────────────────────────────────────────

  describe(GameMcpService.prototype.handleMakeMove.name, () => {
    const fullGame = (extra = {}) => {
      const gm: Record<string, any> = {
        _id: 'game1',
        toJSON: () => ({ ...gm }),
        save: jest.fn(),
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        fen: new Chess().fen(),
        pgn: '',
        lastMoveAt: new Date(Date.now() - 5000),
        whiteTimeRemainingMs: 300000,
        blackTimeRemainingMs: 300000,
        incrementMs: 0,
        ...extra,
      };
      return gm;
    };

    const makeFindByIdChain = (val: unknown): any => {
      // findById() → populate() → populate() [NO .lean()]
      let popCallCount = 0;
      const chain: Record<string, any> = {};
      chain.populate = jest.fn();
      chain.populate.mockImplementation(function (this: Record<string, any>) {
        popCallCount++;
        if (popCallCount === 1) {
          // First .populate(): return object with .populate returning val
          const obj: Record<string, any> = {};
          obj.populate = jest.fn();
          obj.populate.mockReturnValue(val);
          return obj;
        }
        // Second+ .populate(): also return val (for robustness)
        return val;
      });
      return chain;
    };

    it('should throw error when gameId is missing', async () => {
      await expect(
        service.handleMakeMove({ move: 'e4', playerId: 'p1' }),
      ).rejects.toThrow('"gameId" is required');
    });

    it('should throw error when move is missing', async () => {
      await expect(
        service.handleMakeMove({ gameId: 'g1', playerId: 'p1' }),
      ).rejects.toThrow('"move" is required');
    });

    it('should throw error when playerId is missing', async () => {
      await expect(
        service.handleMakeMove({ gameId: 'g1', move: 'e4' }),
      ).rejects.toThrow('"playerId" is required');
    });

    it('should throw error when game not found', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockReturnValue(makeFindByIdChain(null));
      await expect(
        service.handleMakeMove({ gameId: 'nope', move: 'e4', playerId: 'p1' }),
      ).rejects.toThrow('Game nope not found');
    });

    it('should throw error when game is not in progress', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue(
        makeFindByIdChain({
          status: GameStatusEnum.CHECKMATE,
          whitePlayerId: 'w',
          blackPlayerId: 'b',
        }),
      );
      await expect(
        service.handleMakeMove({ gameId: 'g1', move: 'e4', playerId: 'p1' }),
      ).rejects.toThrow('Game not in progress');
    });

    it('should throw error when game is not full yet', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue(
        makeFindByIdChain({
          status: GameStatusEnum.IN_PROGRESS,
          whitePlayerId: 'p1',
          blackPlayerId: null,
        }),
      );
      await expect(
        service.handleMakeMove({ gameId: 'g1', move: 'e4', playerId: 'p1' }),
      ).rejects.toThrow('Game is not full yet');
    });

    it('should throw error when player is not in this game', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockReturnValue(makeFindByIdChain(fullGame()));
      await expect(
        service.handleMakeMove({
          gameId: 'g1',
          move: 'e4',
          playerId: 'unknown',
        }),
      ).rejects.toThrow('You are not in this game');
    });

    it('should throw error when it is not the player turn', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockReturnValue(makeFindByIdChain(fullGame()));
      await expect(
        service.handleMakeMove({
          gameId: 'g1',
          move: 'e4',
          playerId: 'player2',
        }),
      ).rejects.toThrow("Not your turn — it is White's turn");
    });

    it('should name black when it is black turn', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockReturnValue(makeFindByIdChain(fullGame({ pgn: 'e4' })));
      await expect(
        service.handleMakeMove({
          gameId: 'g1',
          move: 'e5',
          playerId: 'player1',
        }),
      ).rejects.toThrow("Not your turn — it is Black's turn");
    });

    it('should throw error on invalid move', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockReturnValue(makeFindByIdChain(fullGame()));
      await expect(
        service.handleMakeMove({
          gameId: 'g1',
          move: 'zzz',
          playerId: 'player1',
        }),
      ).rejects.toThrow('Invalid move');
    });

    it('should throw when chess.js returns no move object', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockReturnValue(makeFindByIdChain(fullGame()));
      jest.spyOn(service, 'loadChessGame').mockReturnValue({
        turn: () => 'w',
        move: () => null,
      } as any);

      await expect(
        service.handleMakeMove({
          gameId: 'g1',
          move: 'e4',
          playerId: 'player1',
        }),
      ).rejects.toThrow('Invalid move: e4');
    });

    it('should successfully make a valid move', async () => {
      const gm = fullGame();
      jest.spyOn(gameModel, 'findById').mockReturnValue(makeFindByIdChain(gm));
      const result = await service.handleMakeMove({
        gameId: 'g1',
        move: 'e4',
        playerId: 'player1',
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.move).toBe('e4');
      expect(parsed.gameEnded).toBe(false);
    });

    it('should make a move when the game has no clock', async () => {
      const gm = fullGame({
        whiteTimeRemainingMs: null,
        blackTimeRemainingMs: null,
      });
      jest.spyOn(gameModel, 'findById').mockReturnValue(makeFindByIdChain(gm));

      const result = await service.handleMakeMove({
        gameId: 'g1',
        move: 'e4',
        playerId: 'player1',
      });

      expect(JSON.parse(result.content[0].text).success).toBe(true);
      expect(gm.whiteTimeRemainingMs).toBeNull();
    });

    it('should add the increment to the clock after a move', async () => {
      const gm = fullGame({ incrementMs: 2000, lastMoveAt: new Date() });
      jest.spyOn(gameModel, 'findById').mockReturnValue(makeFindByIdChain(gm));

      await service.handleMakeMove({
        gameId: 'g1',
        move: 'e4',
        playerId: 'player1',
      });

      expect(gm.whiteTimeRemainingMs).toBeGreaterThan(300000);
    });

    it('should make a move when the game document has no toJSON method', async () => {
      const gm = fullGame();
      delete (gm as { toJSON?: unknown }).toJSON;
      jest.spyOn(gameModel, 'findById').mockReturnValue(makeFindByIdChain(gm));

      const result = await service.handleMakeMove({
        gameId: 'g1',
        move: 'e4',
        playerId: 'player1',
      });

      expect(JSON.parse(result.content[0].text).success).toBe(true);
    });

    it('should set gameEnded to true when move results in checkmate', async () => {
      const chess = new Chess();
      chess.move('f3');
      chess.move('e5');
      chess.move('g4');
      const gm = fullGame({
        save: jest.fn(),
        fen: chess.fen(),
        pgn: chess.pgn(),
        whitePlayer: { rating: 1200 },
        blackPlayer: { rating: 1200 },
      });
      jest.spyOn(gameModel, 'findById').mockReturnValue(makeFindByIdChain(gm));
      const result = await service.handleMakeMove({
        gameId: 'g1',
        move: 'Qh4',
        playerId: 'player2',
      });
      expect(JSON.parse(result.content[0].text).game.status).toBe(
        GameStatusEnum.CHECKMATE,
      );
    });

    it('should call gateway after successful move', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockReturnValue(makeFindByIdChain(fullGame()));
      const emitSpy = jest.spyOn(
        (service as any).gameGateway,
        'emitGameUpdated',
      );
      await service.handleMakeMove({
        gameId: 'g1',
        move: 'e4',
        playerId: 'player1',
      });
      expect(emitSpy).toHaveBeenCalled();
    });

    it('should flag a white timeout when the clock runs out on a move', async () => {
      const gm = fullGame({
        whiteTimeRemainingMs: 1000,
        lastMoveAt: new Date(Date.now() - 5000),
      });
      jest.spyOn(gameModel, 'findById').mockReturnValue(makeFindByIdChain(gm));

      const result = await service.handleMakeMove({
        gameId: 'g1',
        move: 'e4',
        playerId: 'player1',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.game.status).toBe(GameStatusEnum.TIMEOUT);
      expect(parsed.game.winnerId).toBe('player2');
      expect(gm.whiteTimeRemainingMs).toBe(0);
    });

    it('should flag a black timeout when the clock runs out on a move', async () => {
      const gm = fullGame({
        pgn: 'e4',
        blackTimeRemainingMs: 1000,
        lastMoveAt: new Date(Date.now() - 5000),
      });
      jest.spyOn(gameModel, 'findById').mockReturnValue(makeFindByIdChain(gm));

      const result = await service.handleMakeMove({
        gameId: 'g1',
        move: 'e5',
        playerId: 'player2',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.game.status).toBe(GameStatusEnum.TIMEOUT);
      expect(parsed.game.winnerId).toBe('player1');
      expect(gm.blackTimeRemainingMs).toBe(0);
    });

    it('should flag a draw when a timeout occurs and the opponent cannot mate', async () => {
      const gm = fullGame({
        fen: '8/8/4k3/8/8/K7/8/8 w - - 0 1',
        whiteTimeRemainingMs: 1000,
        lastMoveAt: new Date(Date.now() - 5000),
      });
      jest.spyOn(gameModel, 'findById').mockReturnValue(makeFindByIdChain(gm));

      const result = await service.handleMakeMove({
        gameId: 'g1',
        move: 'Kb3',
        playerId: 'player1',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.game.status).toBe(GameStatusEnum.DRAW);
      expect(parsed.game.winnerId).toBeNull();
    });

    it('should process rating changes when white wins by checkmate', async () => {
      const pgn = '1. e4 f6 2. d4 g5';
      const gm = fullGame({
        pgn,
        whitePlayer: { rating: 1200 },
        blackPlayer: { rating: 1200 },
      });
      jest.spyOn(gameModel, 'findById').mockReturnValue(makeFindByIdChain(gm));

      const result = await service.handleMakeMove({
        gameId: 'g1',
        move: 'Qh5',
        playerId: 'player1',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.game.status).toBe(GameStatusEnum.CHECKMATE);
      expect(gm.winnerId).toBe('player1');
      expect(playerModel.updateOne).toHaveBeenCalledTimes(2);
    });

    it('should not recalculate ratings when they are already recorded', async () => {
      const pgn = '1. e4 f6 2. d4 g5';
      const gm = fullGame({
        pgn,
        whitePlayer: { rating: 1200 },
        blackPlayer: { rating: 1200 },
        whiteRatingChange: 10,
        blackRatingChange: -10,
      });
      jest.spyOn(gameModel, 'findById').mockReturnValue(makeFindByIdChain(gm));

      await service.handleMakeMove({
        gameId: 'g1',
        move: 'Qh5',
        playerId: 'player1',
      });

      expect(playerModel.updateOne).not.toHaveBeenCalled();
    });
  });

  // ─── handleGetDurations ────────────────────────────────────────

  describe(GameMcpService.prototype.handleGetDurations.name, () => {
    it('should return durations with values and labels', () => {
      const parsed = JSON.parse(service.handleGetDurations().content[0].text);
      expect(parsed.durations.length).toBeGreaterThan(0);
      expect(parsed.durations[0]).toHaveProperty('value');
      expect(parsed.durations[0]).toHaveProperty('label');
    });

    it('should have correct label for unlimited', () => {
      expect(
        JSON.parse(service.handleGetDurations().content[0].text).durations.find(
          (d: any) => d.value === 'unlimited',
        ).label,
      ).toBe('Unlimited');
    });

    it('should fallback to value when label is not mapped', () => {
      const spy = jest
        .spyOn(Object, 'values')
        .mockReturnValue(['custom'] as any);
      const custom = JSON.parse(
        service.handleGetDurations().content[0].text,
      ).durations.find((d: any) => d.value === 'custom');
      expect(custom.label).toBe('custom');
      spy.mockRestore();
    });
  });

  // ─── handleClaimTimeout ────────────────────────────────────────

  describe(GameMcpService.prototype.handleClaimTimeout.name, () => {
    it('should throw error when gameId is missing', async () => {
      await expect(
        service.handleClaimTimeout({ playerId: 'p1' }),
      ).rejects.toThrow('"gameId" is required');
    });

    it('should throw error when playerId is missing', async () => {
      await expect(
        service.handleClaimTimeout({ gameId: 'g1' }),
      ).rejects.toThrow('"playerId" is required');
    });

    it('should throw error when game not found', async () => {
      jest.spyOn(service, 'findGame').mockResolvedValue(null);
      await expect(
        service.handleClaimTimeout({ gameId: 'nope', playerId: 'p1' }),
      ).rejects.toThrow('Game nope not found');
    });

    it('should throw error when game is not in progress', async () => {
      jest.spyOn(service, 'findGame').mockResolvedValue({
        status: GameStatusEnum.CHECKMATE,
        whitePlayerId: 'w',
        blackPlayerId: 'b',
      } as any);
      await expect(
        service.handleClaimTimeout({ gameId: 'g1', playerId: 'p1' }),
      ).rejects.toThrow('Game is not in progress');
    });

    it('should throw error when game is not full', async () => {
      jest.spyOn(service, 'findGame').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'w',
        blackPlayerId: null,
      } as any);
      await expect(
        service.handleClaimTimeout({ gameId: 'g1', playerId: 'p1' }),
      ).rejects.toThrow('Game is not full yet');
    });

    it('should throw error when game has no time control', async () => {
      jest.spyOn(service, 'findGame').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'w',
        blackPlayerId: 'b',
        lastMoveAt: undefined,
        whiteTimeRemainingMs: undefined,
        blackTimeRemainingMs: undefined,
      } as any);
      await expect(
        service.handleClaimTimeout({ gameId: 'g1', playerId: 'p1' }),
      ).rejects.toThrow('This game does not have a time control');
    });

    it('should throw error when opponent still has time', async () => {
      jest.spyOn(service, 'findGame').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'w',
        blackPlayerId: 'b',
        lastMoveAt: new Date(Date.now() - 5000),
        whiteTimeRemainingMs: 300000,
        blackTimeRemainingMs: 300000,
      } as any);
      await expect(
        service.handleClaimTimeout({ gameId: 'g1', playerId: 'p1' }),
      ).rejects.toThrow(/still has .* remaining/);
    });

    it('should report black as the side that still has time', async () => {
      jest.spyOn(service, 'findGame').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'w',
        blackPlayerId: 'b',
        pgn: 'e4',
        lastMoveAt: new Date(Date.now() - 5000),
        whiteTimeRemainingMs: 300000,
        blackTimeRemainingMs: 300000,
      } as any);

      await expect(
        service.handleClaimTimeout({ gameId: 'g1', playerId: 'b' }),
      ).rejects.toThrow(/^Black still has .* remaining$/);
    });

    it('should successfully claim timeout', async () => {
      const saveSpy = jest.fn();
      jest.spyOn(service, 'findGame').mockResolvedValue({
        _id: 'g1',
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'w',
        blackPlayerId: 'b',
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        whitePlayer: { rating: 1200 },
        blackPlayer: { rating: 1200 },
        save: saveSpy,
        toJSON: () => ({ _id: 'g1' }),
      } as any);
      const result = await service.handleClaimTimeout({
        gameId: 'g1',
        playerId: 'w',
      });
      expect(JSON.parse(result.content[0].text).message).toBe(
        'Timeout claimed',
      );
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should claim a timeout for black and award the win to white', async () => {
      const saveSpy = jest.fn();
      jest.spyOn(service, 'findGame').mockResolvedValue({
        _id: 'g1',
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'w',
        blackPlayerId: 'b',
        pgn: 'e4',
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        whitePlayer: { rating: 1200 },
        blackPlayer: { rating: 1200 },
        save: saveSpy,
      } as any);

      const result = await service.handleClaimTimeout({
        gameId: 'g1',
        playerId: 'b',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.game.status).toBe(GameStatusEnum.TIMEOUT);
      expect(parsed.game.winnerId).toBe('w');
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should declare a draw when black times out and white cannot mate', async () => {
      const saveSpy = jest.fn();
      jest.spyOn(service, 'findGame').mockResolvedValue({
        _id: 'g1',
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'w',
        blackPlayerId: 'b',
        fen: '8/8/4k3/8/8/K7/8/8 b - - 0 1',
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        whitePlayer: { rating: 1200 },
        blackPlayer: { rating: 1200 },
        save: saveSpy,
      } as any);

      const result = await service.handleClaimTimeout({
        gameId: 'g1',
        playerId: 'b',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.game.status).toBe(GameStatusEnum.DRAW);
      expect(parsed.game.winnerId).toBeNull();
    });

    it('should declare a draw when white times out and black cannot mate', async () => {
      const saveSpy = jest.fn();
      jest.spyOn(service, 'findGame').mockResolvedValue({
        _id: 'g1',
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'w',
        blackPlayerId: 'b',
        fen: '8/8/4k3/8/8/K7/8/8 w - - 0 1',
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        whitePlayer: { rating: 1200 },
        blackPlayer: { rating: 1200 },
        save: saveSpy,
      } as any);

      const result = await service.handleClaimTimeout({
        gameId: 'g1',
        playerId: 'w',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.game.status).toBe(GameStatusEnum.DRAW);
      expect(parsed.game.winnerId).toBeNull();
    });

    it('should claim a timeout for a game document without a toJSON method', async () => {
      const saveSpy = jest.fn();
      jest.spyOn(service, 'findGame').mockResolvedValue({
        _id: 'g1',
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'w',
        blackPlayerId: 'b',
        pgn: 'e4',
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        whitePlayer: { rating: 1200 },
        blackPlayer: { rating: 1200 },
        save: saveSpy,
      } as any);

      const result = await service.handleClaimTimeout({
        gameId: 'g1',
        playerId: 'b',
      });

      expect(JSON.parse(result.content[0].text).message).toBe(
        'Timeout claimed',
      );
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  // ─── handleGetPlayerInfo ───────────────────────────────────────

  describe(GameMcpService.prototype.handleGetPlayerInfo.name, () => {
    it('should throw error when userId is missing', async () => {
      await expect(service.handleGetPlayerInfo({})).rejects.toThrow(
        '"userId" is required',
      );
    });

    it('should throw error when player not found', async () => {
      jest
        .spyOn(playerModel, 'findOne')
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as any);
      await expect(
        service.handleGetPlayerInfo({ userId: 'unknown' }),
      ).rejects.toThrow('Player not found for userId: unknown');
    });

    it('should return player info when found', async () => {
      const mockPlayer = {
        _id: 'pid1',
        userId: 'user123',
        isGuest: false,
        nickname: 'Grandmaster',
        rating: 1500,
      };
      jest.spyOn(playerModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockPlayer),
      } as any);
      const result = await service.handleGetPlayerInfo({ userId: 'user123' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.player.userId).toBe('user123');
      expect(parsed.player.nickname).toBe('Grandmaster');
    });
  });

  // ─── canPossiblyCheckmate (private helper) ─────────────────────

  describe('canPossiblyCheckmate (private helper)', () => {
    it('should return false when only king remains', () => {
      const chess = new Chess();
      chess.load('8/8/8/8/8/K7/k7/8 w - - 0 1');
      expect((service as any)['canPossiblyCheckmate'](chess, 'w')).toBe(false);
    });

    it('should return false for king vs king', () => {
      const chess = new Chess();
      chess.load('8/8/8/8/8/K7/k7/8 w - - 0 1');
      expect((service as any)['canPossiblyCheckmate'](chess, 'b')).toBe(false);
    });

    it('should return false for king + bishop vs king', () => {
      const chess = new Chess();
      chess.load('8/b7/4k3/8/8/K7/8/8 w - - 0 1');
      expect((service as any)['canPossiblyCheckmate'](chess, 'w')).toBe(false);
    });

    it('should return false for king + knight vs king', () => {
      const chess = new Chess();
      chess.load('8/n7/4k3/8/8/K7/8/8 w - - 0 1');
      expect((service as any)['canPossiblyCheckmate'](chess, 'w')).toBe(false);
    });

    it('should return false when the side has exactly a king and a bishop', () => {
      const chess = new Chess();
      chess.load('8/8/4k3/8/8/K7/8/B7 w - - 0 1');
      expect((service as any)['canPossiblyCheckmate'](chess, 'w')).toBe(false);
    });

    it('should return false when the side has exactly a king and a knight', () => {
      const chess = new Chess();
      chess.load('8/8/4k3/8/8/K7/8/N7 w - - 0 1');
      expect((service as any)['canPossiblyCheckmate'](chess, 'w')).toBe(false);
    });

    it('should return true for king + queen vs king', () => {
      const chess = new Chess();
      // W: Ka4 + Qa3 vs B: Ke8
      chess.load('8/8/4k3/8/K7/Q7/8/8 w - - 0 1');
      expect((service as any)['canPossiblyCheckmate'](chess, 'w')).toBe(true);
    });

    it('should return true for king + rook vs king', () => {
      const chess = new Chess();
      // W: Ka4 + Ra3 vs B: Ke8
      chess.load('8/8/4k3/8/K7/R7/8/8 w - - 0 1');
      expect((service as any)['canPossiblyCheckmate'](chess, 'w')).toBe(true);
    });

    it('should return true when there are multiple pawns', () => {
      const chess = new Chess();
      chess.load('4k3/pp6/8/8/8/8/P7/K7 w - - 0 1');
      // white has K+3 pawns = 4 pieces → definitely can mate
      expect((service as any)['canPossiblyCheckmate'](chess, 'w')).toBe(true);
    });
  });
});
