import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './game.service';
import { getModelToken } from '@nestjs/mongoose';
import { Player, PlayerDocument } from '../../player/schemas/player.schema';
import { GameStatusEnum } from '../enumerables/game-status.enum';
import { GameDurationEnum } from '../enumerables/game-duration.enum';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Chess } from 'chess.js';
import { Model } from 'mongoose';
import { Game, GameDocument } from '../schemas/game.schema';
import { AuthUser } from 'src/auth/interfaces/auth-user.interface';
import { GameGateway } from '../gateways/game.gateway';

describe(GameService.name, () => {
  let service: GameService;
  let gameModel: Model<GameDocument>;
  let playerModel: Model<PlayerDocument>;

  beforeEach(async () => {
    gameModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      estimatedDocumentCount: jest.fn(),
      find: jest.fn(),
    } as unknown as Model<GameDocument>;
    playerModel = {
      findOne: jest.fn(),
    } as unknown as Model<PlayerDocument>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: getModelToken(Game.name),
          useValue: gameModel,
        },
        {
          provide: getModelToken(Player.name),
          useValue: playerModel,
        },
        {
          provide: GameGateway,
          useValue: { emitGameUpdated: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe(GameService.prototype.getDurations.name, () => {
    it('should return an array of duration objects with values and labels', () => {
      const result = service.getDurations();
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('value');
      expect(result[0]).toHaveProperty('label');
    });

    it('should return exact labels for each GameDurationEnum value', () => {
      const result = service.getDurations();
      const expectedLabels: Record<string, string> = {
        [GameDurationEnum.Unlimited]: 'Unlimited',
        [GameDurationEnum.OneMinute]: '1 minute',
        [GameDurationEnum.ThreePlusTwo]: '3 min + 2 sec',
        [GameDurationEnum.FiveMinutes]: '5 minutes',
        [GameDurationEnum.FivePlusThree]: '5 min + 3 sec',
        [GameDurationEnum.TenMinutes]: '10 minutes',
        [GameDurationEnum.TenPlusFive]: '10 min + 5 sec',
        [GameDurationEnum.FifteenPlusTen]: '15 min + 10 sec',
      };
      result.forEach((item) => {
        expect(item.label).toBe(expectedLabels[item.value as string]);
      });
    });

    it('should fallback to value when label is not in the map', () => {
      const spy = jest
        .spyOn(Object, 'values')
        .mockReturnValue(['UnknownDuration' as any]);
      const result = service.getDurations();
      expect(result[0].label).toBe('UnknownDuration');
      spy.mockRestore();
    });
  });

  describe(GameService.prototype.create.name, () => {
    const mockAuthUser = { sub: 'user1' } as AuthUser;

    it('should throw NotFoundException if player not found', async () => {
      jest.spyOn(playerModel, 'findOne').mockResolvedValue(null);

      await expect(
        service.create({ duration: 'unlimited' } as any, mockAuthUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should join an existing waiting game when one is available', async () => {
      const mockPlayer = { _id: { toString: () => 'player1' } };
      const mockWaitingGame = {
        _id: { toString: () => 'game1' },
        pgn: '',
        fen: new Chess().fen(),
        toJSON: () => ({ _id: 'game1' }),
      };

      jest.spyOn(playerModel, 'findOne').mockResolvedValue(mockPlayer as any);
      jest
        .spyOn(gameModel, 'findOneAndUpdate')
        .mockResolvedValue(mockWaitingGame);

      /* eslint-disable @typescript-eslint/no-unsafe-argument */
      const result = await service.create(
        { duration: 'unlimited' } as any,
        mockAuthUser,
      );
      /* eslint-enable @typescript-eslint/no-unsafe-argument */

      expect(result).toEqual(mockWaitingGame);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(gameModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it('should create a new game when no waiting game is found', async () => {
      const mockPlayer = { _id: { toString: () => 'player1' } };
      const mockNewGame = { _id: 'newGame1' };

      jest.spyOn(playerModel, 'findOne').mockResolvedValue(mockPlayer as any);
      jest.spyOn(gameModel, 'findOneAndUpdate').mockResolvedValue(null);
      jest.spyOn(gameModel, 'create').mockResolvedValue(mockNewGame as any);

      /* eslint-disable @typescript-eslint/no-unsafe-argument */
      const result = await service.create(
        { duration: 'unlimited' } as any,
        mockAuthUser,
      );
      /* eslint-enable @typescript-eslint/no-unsafe-argument */

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(gameModel.create).toHaveBeenCalled();
      expect(result).toEqual(mockNewGame);
    });

    it('should call findOneAndUpdate with exact arguments', async () => {
      const mockPlayer = { _id: { toString: () => 'player1' } };
      jest.spyOn(playerModel, 'findOne').mockResolvedValue(mockPlayer as any);
      const findOneAndUpdateSpy = jest
        .spyOn(gameModel, 'findOneAndUpdate')
        .mockResolvedValue(null);
      jest.spyOn(gameModel, 'create').mockResolvedValue({} as any);

      await service.create({ duration: GameDurationEnum.FiveMinutes }, {
        sub: 'user1',
      } as any);

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        {
          blackPlayerId: null,
          whitePlayerId: { $ne: mockPlayer._id },
          duration: GameDurationEnum.FiveMinutes,
        },
        {
          $set: {
            blackPlayerId: mockPlayer._id,
            status: GameStatusEnum.IN_PROGRESS,
            lastMoveAt: expect.any(Date),
          },
        },
        { returnDocument: 'after' },
      );
    });

    it('should emit broadcastGameUpdate when joining a waiting game', async () => {
      const mockPlayer = { _id: { toString: () => 'player1' } };
      const mockWaitingGame = {
        _id: { toString: () => 'game1' },
        pgn: '',
        fen: new Chess().fen(),
        toJSON: () => ({ _id: 'game1' }),
      };
      jest.spyOn(playerModel, 'findOne').mockResolvedValue(mockPlayer as any);
      jest
        .spyOn(gameModel, 'findOneAndUpdate')
        .mockResolvedValue(mockWaitingGame);
      const emitSpy = jest.spyOn(service['gameGateway'], 'emitGameUpdated');

      await service.create(
        { duration: 'unlimited' } as any,
        { sub: 'user1' } as any,
      );

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should create game with correct incrementMs for timed game', async () => {
      const mockPlayer = { _id: { toString: () => 'player1' } };
      jest.spyOn(playerModel, 'findOne').mockResolvedValue(mockPlayer as any);
      jest.spyOn(gameModel, 'findOneAndUpdate').mockResolvedValue(null);
      const createSpy = jest
        .spyOn(gameModel, 'create')
        .mockResolvedValue({} as any);

      await service.create({ duration: GameDurationEnum.ThreePlusTwo }, {
        sub: 'user1',
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          whitePlayerId: mockPlayer._id,
          incrementMs: 2000,
        }),
      );
    });

    it('should create game with incrementMs 0 for unlimited duration', async () => {
      const mockPlayer = { _id: { toString: () => 'player1' } };
      jest.spyOn(playerModel, 'findOne').mockResolvedValue(mockPlayer as any);
      jest.spyOn(gameModel, 'findOneAndUpdate').mockResolvedValue(null);
      const createSpy = jest
        .spyOn(gameModel, 'create')
        .mockResolvedValue({} as any);

      await service.create({ duration: GameDurationEnum.Unlimited }, {
        sub: 'user1',
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          whitePlayerId: mockPlayer._id,
          incrementMs: 0,
        }),
      );
    });
  });

  describe(GameService.prototype.findAll.name, () => {
    it('should return a list of games with total count using skip and limit', async () => {
      const mockGames = [{ _id: '1' }, { _id: '2' }];

      const mockFind = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockGames),
              }),
            }),
          }),
        }),
      });

      const spyCount = jest
        .spyOn(gameModel, 'estimatedDocumentCount')
        .mockResolvedValue(2);
      const spyFind = jest
        .spyOn(gameModel, 'find')
        .mockImplementation(mockFind);

      const result = await service.findAll(0, 10);

      expect(spyCount).toHaveBeenCalled();
      expect(spyFind).toHaveBeenCalled();
      expect(result).toEqual({ data: mockGames, total: 2 });
    });

    it('should use default skip and limit when not provided', async () => {
      const mockGames = [{ _id: '1' }, { _id: '2' }];
      const findObj = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockGames),
      };
      jest.spyOn(gameModel, 'find').mockReturnValue(findObj as any);
      jest.spyOn(gameModel, 'estimatedDocumentCount').mockResolvedValue(2);

      const result = await service.findAll();
      expect(findObj.skip).toHaveBeenCalledWith(0);
      expect(findObj.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: mockGames, total: 2 });
    });
  });

  describe(GameService.prototype.findOne.name, () => {
    it('should return a game by id', async () => {
      const mockGame = { _id: 'game1', fen: new Chess().fen() };

      const mockQuery = {
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockGame),
          }),
        }),
      };

      jest
        .spyOn(gameModel, 'findById')
        .mockReturnValue(
          mockQuery as unknown as ReturnType<typeof gameModel.findById>,
        );

      const result = await service.findOne('game1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(gameModel.findById).toHaveBeenCalledWith('game1');
      expect(result).toEqual(mockGame);
    });
  });

  describe(GameService.prototype.getBoard.name, () => {
    it('should throw NotFoundException if game not found', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      } as any);
      await expect(service.getBoard('1')).rejects.toThrow(NotFoundException);
    });

    it('should return board and fen', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ fen: new Chess().fen() }),
      } as any);
      const result = await service.getBoard('1');
      expect(result).toHaveProperty('fen');
      expect(result).toHaveProperty('board');
    });

    it('should throw BadRequestException if FEN is invalid', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ fen: 'invalid-fen' }),
      } as any);
      await expect(service.getBoard('1')).rejects.toThrow(BadRequestException);
    });
  });

  describe(GameService.prototype.getMoves.name, () => {
    it('should throw NotFoundException if game not found', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      } as any);
      await expect(service.getMoves('1')).rejects.toThrow(NotFoundException);
    });

    it('should return available moves', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ fen: new Chess().fen() }),
      } as any);
      const moves = await service.getMoves('1');
      expect(Array.isArray(moves)).toBeTruthy();
      expect(moves.length).toBeGreaterThan(0);
    });

    it('should throw BadRequestException if FEN is invalid', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ fen: 'invalid-fen' }),
      } as any);
      await expect(service.getMoves('1')).rejects.toThrow(BadRequestException);
    });
  });

  describe(GameService.prototype.makeMove.name, () => {
    it('should throw NotFoundException if game not found', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue(null);
      await expect(
        service.makeMove('1', { move: 'e4' }, {
          sub: 'user1',
        } as unknown as AuthUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if game is not full', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockResolvedValue({ whitePlayerId: 'player1' });
      await expect(
        service.makeMove('1', { move: 'e4' }, {
          sub: 'user1',
        } as unknown as AuthUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if game is not in progress', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.WAITING_PLAYER,
      });
      await expect(
        service.makeMove('1', { move: 'e4' }, {
          sub: 'user1',
        } as unknown as AuthUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if player not found', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.IN_PROGRESS,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue(null);
      await expect(
        service.makeMove('1', { move: 'e4' }, {
          sub: 'user1',
        } as unknown as AuthUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if it is not player turn', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.IN_PROGRESS,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);
      await expect(
        service.makeMove('1', { move: 'e4' }, {
          sub: 'user1',
        } as unknown as AuthUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException on invalid move', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.IN_PROGRESS,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      await expect(
        service.makeMove('1', { move: 'invalid' }, {
          sub: 'user1',
        } as unknown as AuthUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should execute move successfully and update game state', async () => {
      const mockSave = jest.fn();
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      const result = await service.makeMove('1', { move: 'e4' }, {
        sub: 'user1',
      } as unknown as AuthUser);
      expect(result.fen).not.toBe(new Chess().fen());
      expect(mockSave).toHaveBeenCalled();
    });

    it('should execute move successfully when game has no time control (unlimited)', async () => {
      const mockSave = jest.fn();
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
        // lastMoveAt, whiteTimeRemainingMs, blackTimeRemainingMs intentionally absent
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);

      const result = await service.makeMove('1', { move: 'e4' }, {
        sub: 'user1',
      } as unknown as AuthUser);

      // Move should succeed — time control is skipped via early-return
      expect(result.fen).not.toBe(new Chess().fen());
      expect(mockSave).toHaveBeenCalled();
    });

    it('should throw BadRequestException if time is up for white player', async () => {
      const mockSave = jest.fn();
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
        lastMoveAt: new Date(Date.now() - 60000), // 1 minute ago
        whiteTimeRemainingMs: 30000, // Only 30 seconds left
        blackTimeRemainingMs: 60000,
        incrementMs: 0,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);

      await expect(
        service.makeMove('1', { move: 'e4' }, {
          sub: 'user1',
        } as unknown as AuthUser),
      ).rejects.toThrow(BadRequestException);
      expect(gameMock.status).toBe(GameStatusEnum.TIMEOUT);
      expect(mockSave).toHaveBeenCalled();
    });

    it('should throw BadRequestException if time is up for black player', async () => {
      const mockSave = jest.fn();
      // It's black's turn after e4
      const chess = new Chess();
      chess.move('e4');
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: chess.fen(),
        pgn: chess.pgn(),
        lastMoveAt: new Date(Date.now() - 60000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 30000, // Only 30 seconds left for black
        incrementMs: 0,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);

      await expect(
        service.makeMove('1', { move: 'e5' }, {
          sub: 'user2',
        } as unknown as AuthUser),
      ).rejects.toThrow(BadRequestException);
      expect(gameMock.status).toBe(GameStatusEnum.TIMEOUT);
      expect(mockSave).toHaveBeenCalled();
    });

    it('should set status to CHECKMATE when move results in checkmate', async () => {
      // Fool's mate: f3, e5, g4 → Qh4#
      const chess = new Chess();
      chess.move('f3');
      chess.move('e5');
      chess.move('g4');

      const mockSave = jest.fn();
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: chess.fen(),
        pgn: chess.pgn(),
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      // Black plays Qh4#
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);

      const result = await service.makeMove('1', { move: 'Qh4' }, {
        sub: 'user2',
      } as unknown as AuthUser);

      expect(result.status).toBe(GameStatusEnum.CHECKMATE);
      expect(mockSave).toHaveBeenCalled();
    });

    it('should decrease remaining time and add incrementMs for white player', async () => {
      const mockSave = jest.fn();
      const lastMoveAt = new Date(Date.now() - 5000);
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
        lastMoveAt,
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        incrementMs: 2000,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);

      const result = await service.makeMove('1', { move: 'e4' }, {
        sub: 'user1',
      } as unknown as AuthUser);

      expect(result.whiteTimeRemainingMs).toBeGreaterThan(56000);
      expect(result.whiteTimeRemainingMs).toBeLessThan(57100);
    });

    it('should decrease remaining time and add incrementMs for black player', async () => {
      const mockSave = jest.fn();
      const chess = new Chess();
      chess.move('e4');
      const lastMoveAt = new Date(Date.now() - 5000);
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: chess.fen(),
        pgn: chess.pgn(),
        lastMoveAt,
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        incrementMs: 2000,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);

      const result = await service.makeMove('1', { move: 'e5' }, {
        sub: 'user2',
      } as unknown as AuthUser);

      expect(result.blackTimeRemainingMs).toBeGreaterThan(56000);
      expect(result.blackTimeRemainingMs).toBeLessThan(57100);
    });

    it('should reject with exact Game is not full yet error message', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockResolvedValue({ whitePlayerId: 'player1' });
      await expect(
        service.makeMove('1', { move: 'e4' }, {
          sub: 'user1',
        } as unknown as AuthUser),
      ).rejects.toThrow('Game is not full yet');
    });

    it('should reject with exact Game is not in progress error message', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.WAITING_PLAYER,
      });
      await expect(
        service.makeMove('1', { move: 'e4' }, {
          sub: 'user1',
        } as unknown as AuthUser),
      ).rejects.toThrow('Game is not in progress');
    });

    it('should reject with exact Game not found error message', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue(null);
      await expect(
        service.makeMove('1', { move: 'e4' }, {
          sub: 'user1',
        } as unknown as AuthUser),
      ).rejects.toThrow('Game not found');
    });

    it('should reject with exact Player not found error message', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.IN_PROGRESS,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue(null);
      await expect(
        service.makeMove('1', { move: 'e4' }, {
          sub: 'user1',
        } as unknown as AuthUser),
      ).rejects.toThrow('Player not found');
    });
  });

  describe('broadcastGameUpdate failure (via makeMove)', () => {
    beforeEach(() => {
      const gameMock = {
        _id: { toString: () => 'game-1' },
        toJSON: () => ({ id: 'game-1' }),
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
        save: jest.fn(),
      };

      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
    });

    it('should log error when emitGameUpdated throws an Error', async () => {
      const error = new Error('Gateway Error');
      jest
        .spyOn(service['gameGateway'], 'emitGameUpdated')
        .mockImplementation(() => {
          throw error;
        });
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.makeMove('game-1', { move: 'e4' }, { sub: 'user1' } as any);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to broadcast game update',
        error.stack,
      );
    });

    it('should log stringified error when emitGameUpdated throws a non-Error', async () => {
      const error = 'String Error';
      jest
        .spyOn(service['gameGateway'], 'emitGameUpdated')
        .mockImplementation(() => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw error;
        });
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.makeMove('game-1', { move: 'e4' }, { sub: 'user1' } as any);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to broadcast game update',
        String(error),
      );
    });
  });

  describe(GameService.prototype.claimTimeout.name, () => {
    const mockAuthUser = { sub: 'user1' } as AuthUser;

    it('should throw NotFoundException if game not found', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue(null);
      await expect(service.claimTimeout('1', mockAuthUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if game is not in progress', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.WAITING_PLAYER,
      });
      await expect(service.claimTimeout('1', mockAuthUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if game is not full', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'player1',
      });
      await expect(service.claimTimeout('1', mockAuthUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if player not found', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue(null);
      await expect(service.claimTimeout('1', mockAuthUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not in the game', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player3' },
      } as any);
      await expect(service.claimTimeout('1', mockAuthUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when game has no time control', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
        // lastMoveAt and timeRemainingMs not set
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);

      await expect(service.claimTimeout('1', mockAuthUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if time is not up yet', async () => {
      const gameMock = {
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
        lastMoveAt: new Date(Date.now() - 10000), // 10 seconds ago
        whiteTimeRemainingMs: 60000, // 60 seconds left
        blackTimeRemainingMs: 60000,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);

      await expect(service.claimTimeout('1', mockAuthUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should set status to TIMEOUT and save if white time is up', async () => {
      const mockSave = jest.fn();
      const gameMock = {
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
        lastMoveAt: new Date(Date.now() - 70000), // 70 seconds ago
        whiteTimeRemainingMs: 60000, // 60 seconds left
        blackTimeRemainingMs: 60000,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);

      const result = await service.claimTimeout('1', mockAuthUser);
      expect(result.status).toBe(GameStatusEnum.TIMEOUT);
      expect(mockSave).toHaveBeenCalled();
    });

    it('should set status to TIMEOUT and save if black time is up', async () => {
      const mockSave = jest.fn();
      // After e4 it's black's turn
      const chess = new Chess();
      chess.move('e4');
      const gameMock = {
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: chess.fen(),
        pgn: chess.pgn(),
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);

      const result = await service.claimTimeout('1', {
        sub: 'user2',
      } as AuthUser);
      expect(result.status).toBe(GameStatusEnum.TIMEOUT);
      expect(mockSave).toHaveBeenCalled();
    });

    // --- Mutant killers: IDs 287, 256, 262, 270, 277, 304, 316 (exact error messages) ---
    it('should throw "You are not a player in this game" with exact message', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player3' },
      } as any);
      await expect(
        service.claimTimeout('1', { sub: 'user1' } as AuthUser),
      ).rejects.toThrow('You are not a player in this game');
    });

    it('should throw "Game not found" with exact message in claimTimeout', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue(null);
      await expect(
        service.claimTimeout('1', { sub: 'user1' } as AuthUser),
      ).rejects.toThrow('Game not found');
    });

    it('should throw "Game is not in progress" with exact message in claimTimeout', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.WAITING_PLAYER,
      });
      await expect(
        service.claimTimeout('1', { sub: 'user1' } as AuthUser),
      ).rejects.toThrow('Game is not in progress');
    });

    it('should throw "Game is not full yet" with exact message in claimTimeout', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'player1',
      });
      await expect(
        service.claimTimeout('1', { sub: 'user1' } as AuthUser),
      ).rejects.toThrow('Game is not full yet');
    });

    it('should throw "Player not found" with exact message in claimTimeout', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue(null);
      await expect(
        service.claimTimeout('1', { sub: 'user1' } as AuthUser),
      ).rejects.toThrow('Player not found');
    });

    it('should throw "This game does not have a time control" with exact message', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      await expect(
        service.claimTimeout('1', { sub: 'user1' } as AuthUser),
      ).rejects.toThrow('This game does not have a time control');
    });

    it('should throw "Time is not up yet" with exact message', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
        lastMoveAt: new Date(Date.now() - 5000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      await expect(
        service.claimTimeout('1', { sub: 'user1' } as AuthUser),
      ).rejects.toThrow('Time is not up yet');
    });

    // --- Mutant killer: ID 307 (remaining === 0 boundary) ---
    it('should set TIMEOUT when remaining is exactly 0 for white in claimTimeout', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const mockSave = jest.fn();
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
        lastMoveAt: new Date('2024-01-01T11:59:00Z'), // exactly 60 seconds ago
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        save: mockSave,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      const result = await service.claimTimeout('1', { sub: 'user1' } as AuthUser);
      expect(result.status).toBe(GameStatusEnum.TIMEOUT);
      jest.useRealTimers();
    });

    // --- Mutant killers: IDs 310, 311, 312, 313 (isWhiteTurn branches) ---
    it('should zero whiteTimeRemainingMs and NOT blackTimeRemainingMs on white timeout', async () => {
      const mockSave = jest.fn();
      const gameMock = {
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      await service.claimTimeout('1', { sub: 'user1' } as AuthUser);
      expect(gameMock.whiteTimeRemainingMs).toBe(0);
      expect(gameMock.blackTimeRemainingMs).toBe(60000);
    });

    it('should zero blackTimeRemainingMs and NOT whiteTimeRemainingMs on black timeout', async () => {
      const mockSave = jest.fn();
      const chess = new Chess();
      chess.move('e4');
      const gameMock = {
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        pgn: chess.pgn(),
        fen: chess.fen(),
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);
      await service.claimTimeout('1', { sub: 'user2' } as AuthUser);
      expect(gameMock.blackTimeRemainingMs).toBe(0);
      expect(gameMock.whiteTimeRemainingMs).toBe(60000);
    });

    // --- Mutant killer: ID 314 ---
    it('should call broadcastGameUpdate when timeout is claimed successfully', async () => {
      const mockSave = jest.fn();
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        _id: { toString: () => 'game1' },
        toJSON: () => ({}),
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        save: mockSave,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      const emitSpy = jest.spyOn(service['gameGateway'], 'emitGameUpdated');
      await service.claimTimeout('1', { sub: 'user1' } as AuthUser);
      expect(emitSpy).toHaveBeenCalled();
    });

    // --- Mutant killers: IDs 294–300 (guard clause isolation in claimTimeout) ---
    it('should throw BadRequestException when only lastMoveAt is missing in claimTimeout', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      await expect(
        service.claimTimeout('1', { sub: 'user1' } as AuthUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when only whiteTimeRemainingMs is missing in claimTimeout', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
        lastMoveAt: new Date(),
        blackTimeRemainingMs: 60000,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      await expect(
        service.claimTimeout('1', { sub: 'user1' } as AuthUser),
      ).rejects.toThrow('This game does not have a time control');
    });

    it('should throw BadRequestException when only blackTimeRemainingMs is missing in claimTimeout', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
        lastMoveAt: new Date(),
        whiteTimeRemainingMs: 60000,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      await expect(
        service.claimTimeout('1', { sub: 'user1' } as AuthUser),
      ).rejects.toThrow('This game does not have a time control');
    });

    // --- Mutant killers: IDs 288–291 (isWhiteTurn equality check) ---
    it('should detect white turn and zero correct time slot', async () => {
      const mockSave = jest.fn();
      const gameMock = {
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        fen: new Chess().fen(),
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      await service.claimTimeout('1', { sub: 'user1' } as AuthUser);
      expect(gameMock.whiteTimeRemainingMs).toBe(0);
      expect(gameMock.blackTimeRemainingMs).not.toBe(0);
    });

    it('should detect black turn and zero correct time slot', async () => {
      const mockSave = jest.fn();
      const chess = new Chess();
      chess.move('e4');
      const gameMock = {
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        pgn: chess.pgn(),
        fen: chess.fen(),
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);
      await service.claimTimeout('1', { sub: 'user2' } as AuthUser);
      expect(gameMock.blackTimeRemainingMs).toBe(0);
      expect(gameMock.whiteTimeRemainingMs).not.toBe(0);
    });
  });

  // ============================================================
  // makeMove — additional mutant killers
  // ============================================================
  describe('makeMove — additional mutant killers', () => {
    // --- Mutant killers: IDs 206–212 (handleTimeControl guard clauses) ---
    it('should skip time control when only lastMoveAt is missing', async () => {
      const mockSave = jest.fn();
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        incrementMs: 0,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      const result = await service.makeMove('1', { move: 'e4' }, {
        sub: 'user1',
      } as unknown as AuthUser);
      expect(mockSave).toHaveBeenCalled();
      expect(result.whiteTimeRemainingMs).toBe(60000);
    });

    it('should skip time control when only whiteTimeRemainingMs is missing', async () => {
      const mockSave = jest.fn();
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
        lastMoveAt: new Date(),
        blackTimeRemainingMs: 60000,
        incrementMs: 0,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      const result = await service.makeMove('1', { move: 'e4' }, { sub: 'user1' } as unknown as AuthUser);
      expect(mockSave).toHaveBeenCalled();
      expect(result.whiteTimeRemainingMs).toBeUndefined();
    });

    it('should skip time control when only blackTimeRemainingMs is missing', async () => {
      const mockSave = jest.fn();
      const chess = new Chess();
      chess.move('e4'); // Now it's black's turn
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: chess.fen(),
        lastMoveAt: new Date(),
        whiteTimeRemainingMs: 60000,
        incrementMs: 0,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);
      const result = await service.makeMove('1', { move: 'e5' }, { sub: 'user2' } as unknown as AuthUser);
      expect(mockSave).toHaveBeenCalled();
      expect(result.blackTimeRemainingMs).toBeUndefined();
    });

    // --- Mutant killers: IDs 220, 230 (remaining === 0 boundary) ---
    it('should set TIMEOUT when white remaining is exactly 0 in makeMove', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const mockSave = jest.fn();
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
        lastMoveAt: new Date('2024-01-01T11:59:00Z'), // exactly 60s ago
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        incrementMs: 0,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      await expect(
        service.makeMove('1', { move: 'e4' }, { sub: 'user1' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(gameMock.status).toBe(GameStatusEnum.TIMEOUT);
      expect(gameMock.whiteTimeRemainingMs).toBe(0);
      jest.useRealTimers();
    });

    it('should set TIMEOUT when black remaining is exactly 0 in makeMove', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const mockSave = jest.fn();
      const chess = new Chess();
      chess.move('e4');
      const gameMock = {
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        pgn: chess.pgn(),
        fen: chess.fen(),
        lastMoveAt: new Date('2024-01-01T11:59:00Z'), // exactly 60s ago
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        incrementMs: 0,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);
      await expect(
        service.makeMove('1', { move: 'e5' }, { sub: 'user2' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(gameMock.status).toBe(GameStatusEnum.TIMEOUT);
      expect(gameMock.blackTimeRemainingMs).toBe(0);
      jest.useRealTimers();
    });

    // --- Mutant killers: IDs 223, 233 (broadcastGameUpdate called on timeout) ---
    it('should call broadcastGameUpdate when white times out in makeMove', async () => {
      const mockSave = jest.fn();
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        _id: { toString: () => 'game1' },
        toJSON: () => ({}),
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        incrementMs: 0,
        save: mockSave,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      const emitSpy = jest.spyOn(service['gameGateway'], 'emitGameUpdated');
      await expect(
        service.makeMove('1', { move: 'e4' }, { sub: 'user1' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(emitSpy).toHaveBeenCalled();
    });

    it('should call broadcastGameUpdate when black times out in makeMove', async () => {
      const mockSave = jest.fn();
      const chess = new Chess();
      chess.move('e4');
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        _id: { toString: () => 'game1' },
        toJSON: () => ({}),
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        pgn: chess.pgn(),
        fen: chess.fen(),
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        incrementMs: 0,
        save: mockSave,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);
      const emitSpy = jest.spyOn(service['gameGateway'], 'emitGameUpdated');
      await expect(
        service.makeMove('1', { move: 'e5' }, { sub: 'user2' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(emitSpy).toHaveBeenCalled();
    });

    // --- Mutant killers: IDs 225, 235 (exact timeout messages) ---
    it('should throw "Time is up for White" with exact message', async () => {
      const mockSave = jest.fn();
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        _id: { toString: () => 'game1' },
        toJSON: () => ({ _id: 'game1' }),
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        incrementMs: 0,
        save: mockSave,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      await expect(
        service.makeMove('1', { move: 'e4' }, { sub: 'user1' } as any),
      ).rejects.toThrow('Time is up for White');
    });

    it('should throw "Time is up for Black" with exact message', async () => {
      const mockSave = jest.fn();
      const chess = new Chess();
      chess.move('e4');
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        _id: { toString: () => 'game1' },
        toJSON: () => ({ _id: 'game1' }),
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        pgn: chess.pgn(),
        fen: chess.fen(),
        lastMoveAt: new Date(Date.now() - 70000),
        whiteTimeRemainingMs: 60000,
        blackTimeRemainingMs: 60000,
        incrementMs: 0,
        save: mockSave,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);
      await expect(
        service.makeMove('1', { move: 'e5' }, { sub: 'user2' } as any),
      ).rejects.toThrow('Time is up for Black');
    });

    // --- Mutant killers: IDs 243, 246 (DRAW vs CHECKMATE vs IN_PROGRESS) ---
    it('should set status DRAW when move causes stalemate', async () => {
      // FEN: white king c2, white queen b1, black king a1 — Qb3 causes stalemate
      const preStalemateFen = '8/8/8/8/8/2K5/8/kQ6 w - - 0 1';
      const mockSave = jest.fn();
      const gameMock = {
        _id: { toString: () => 'game1' },
        toJSON: () => ({ _id: 'game1' }),
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: preStalemateFen,
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      const result = await service.makeMove('1', { move: 'Qb3' }, {
        sub: 'user1',
      } as unknown as AuthUser);
      expect(result.status).toBe(GameStatusEnum.DRAW);
    });

    it('should NOT change status when move does not end the game', async () => {
      const mockSave = jest.fn();
      const gameMock = {
        _id: { toString: () => 'game1' },
        toJSON: () => ({ _id: 'game1' }),
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
        save: mockSave,
      };
      jest.spyOn(gameModel, 'findById').mockResolvedValue(gameMock);
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      const result = await service.makeMove('1', { move: 'e4' }, {
        sub: 'user1',
      } as unknown as AuthUser);
      expect(result.status).toBe(GameStatusEnum.IN_PROGRESS);
    });

    // --- Mutant killer: ID 242 ---
    it('should throw "Invalid move" with exact message', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      await expect(
        service.makeMove('1', { move: 'z9' }, { sub: 'user1' } as any),
      ).rejects.toThrow('Invalid move');
    });

    // --- Mutant killer: ID 202 ---
    it('should throw "Not your turn or you are not in this game" with exact message', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player2' },
      } as any);
      await expect(
        service.makeMove('1', { move: 'e4' }, { sub: 'user1' } as any),
      ).rejects.toThrow('Not your turn or you are not in this game');
    });

    // --- Mutant killer: ID 161 ---
    it('should query playerModel with { userId: authUser.sub } in makeMove', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
      });
      const findOneSpy = jest.spyOn(playerModel, 'findOne').mockResolvedValue(null);
      await expect(
        service.makeMove('1', { move: 'e4' }, { sub: 'user-abc' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(findOneSpy).toHaveBeenCalledWith({ userId: 'user-abc' });
    });
  });

  // ============================================================
  // create — additional mutant killers
  // ============================================================
  describe('create — additional mutant killers', () => {
    // --- Mutant killers: IDs 98, 104 ---
    it('should query playerModel with { userId: authUser.sub } in create', async () => {
      const findOneSpy = jest.spyOn(playerModel, 'findOne').mockResolvedValue(null);
      await expect(
        service.create({ duration: 'unlimited' } as any, { sub: 'specific-user' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(findOneSpy).toHaveBeenCalledWith({ userId: 'specific-user' });
    });

    it('should throw "Player not found" with exact message in create', async () => {
      jest.spyOn(playerModel, 'findOne').mockResolvedValue(null);
      await expect(
        service.create({ duration: 'unlimited' } as any, { sub: 'user1' } as any),
      ).rejects.toThrow('Player not found');
    });
  });

  // ============================================================
  // claimTimeout — playerModel query filter
  // ============================================================
  describe('claimTimeout — playerModel query filter', () => {
    // --- Mutant killer: ID 271 ---
    it('should query playerModel with { userId: authUser.sub } in claimTimeout', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        status: GameStatusEnum.IN_PROGRESS,
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
      });
      const findOneSpy = jest.spyOn(playerModel, 'findOne').mockResolvedValue(null);
      await expect(
        service.claimTimeout('1', { sub: 'specific-user' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(findOneSpy).toHaveBeenCalledWith({ userId: 'specific-user' });
    });
  });

  // ============================================================
  // findAll / findOne — populate field names
  // ============================================================
  describe('findAll — populate field names', () => {
    // --- Mutant killers: IDs 139, 140 ---
    it('should call populate with "whitePlayer" and "blackPlayer" in findAll', async () => {
      const secondPopulate = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });
      jest.spyOn(gameModel, 'estimatedDocumentCount').mockResolvedValue(0);
      jest.spyOn(gameModel, 'find').mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ populate: firstPopulate }),
        }),
      } as any);
      await service.findAll(0, 10);
      expect(firstPopulate).toHaveBeenCalledWith('whitePlayer');
      expect(secondPopulate).toHaveBeenCalledWith('blackPlayer');
    });
  });

  describe('findOne — populate field names', () => {
    // --- Mutant killers: IDs 143, 144 ---
    it('should call populate with "whitePlayer" and "blackPlayer" in findOne', async () => {
      const secondPopulate = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        populate: firstPopulate,
      } as any);
      await service.findOne('game1');
      expect(firstPopulate).toHaveBeenCalledWith('whitePlayer');
      expect(secondPopulate).toHaveBeenCalledWith('blackPlayer');
    });
  });

  // ============================================================
  // getBoard / getMoves — exact error messages
  // ============================================================
  describe('getBoard — exact error message', () => {
    // --- Mutant killer: ID 151 ---
    it('should throw "Game not found" with exact message', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      } as any);
      await expect(service.getBoard('1')).rejects.toThrow('Game not found');
    });
  });

  describe('getMoves — exact error message', () => {
    // --- Mutant killer: ID 159 ---
    it('should throw "Game not found" with exact message', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      } as any);
      await expect(service.getMoves('1')).rejects.toThrow('Game not found');
    });
  });

  // ============================================================
  // loadChessGame — PGN and FEN branch coverage
  // ============================================================
  describe('loadChessGame — PGN and FEN branches', () => {
    // --- Mutant killer: ID 330 ---
    it('should load game state from PGN when pgn is set', async () => {
      const chess = new Chess();
      chess.move('e4');
      chess.move('e5');
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ pgn: chess.pgn() }),
      } as any);
      const result = await service.getBoard('1');
      expect(result).toHaveProperty('fen');
      expect(result.fen).not.toBe(new Chess().fen());
    });

    // --- Mutant killer: ID 333 ---
    it('should load game state from FEN when pgn is absent', async () => {
      const chess = new Chess();
      chess.move('e4');
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ fen: chess.fen() }),
      } as any);
      const result = await service.getBoard('1');
      expect(result.fen).toBe(chess.fen());
    });

    it('should throw BadRequestException when neither pgn nor fen is set', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ pgn: '', fen: '' }),
      } as any);
      await expect(service.getBoard('1')).rejects.toThrow('No game state found');
    });

    // --- Mutant killer: ID 342 ---
    it('should throw "Invalid or corrupted game state" with exact message', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ fen: 'invalid-fen' }),
      } as any);
      await expect(service.getBoard('1')).rejects.toThrow(
        'Invalid or corrupted game state',
      );
    });
  });

  // ============================================================
  // broadcastGameUpdate — boardData object shape
  // ============================================================
  describe('broadcastGameUpdate — boardData object', () => {
    // --- Mutant killer: ID 322 ---
    it('should emit boardData with fen and board properties', async () => {
      const mockSave = jest.fn();
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        _id: { toString: () => 'game1' },
        toJSON: () => ({ id: 'game1' }),
        whitePlayerId: { toString: () => 'player1' },
        blackPlayerId: { toString: () => 'player2' },
        status: GameStatusEnum.IN_PROGRESS,
        fen: new Chess().fen(),
        save: mockSave,
      });
      jest.spyOn(playerModel, 'findOne').mockResolvedValue({
        _id: { toString: () => 'player1' },
      } as any);
      const emitSpy = jest.spyOn(service['gameGateway'], 'emitGameUpdated');
      await service.makeMove('1', { move: 'e4' }, { sub: 'user1' } as any);
      expect(emitSpy).toHaveBeenCalledWith(
        'game1',
        expect.anything(),
        expect.objectContaining({
          fen: expect.any(String),
          board: expect.any(Array),
        }),
      );
    });
  });
});
