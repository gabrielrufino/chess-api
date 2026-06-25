import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './game.service';
import { getModelToken } from '@nestjs/mongoose';
import { Player, PlayerDocument } from '../../player/schemas/player.schema';
import { GameStatusEnum } from '../enumerables/game-status.enum';
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
import { UpdateGameDto } from '../dto/update-game.dto';

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
  });

  describe(GameService.prototype.create.name, () => {
    const mockAuthUser = { sub: 'user1' } as AuthUser;

    it('should throw NotFoundException if player not found', async () => {
      jest.spyOn(playerModel, 'findOne').mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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

      /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
      const result = await service.create(
        { duration: 'unlimited' } as any,
        mockAuthUser,
      );
      /* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */

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

      /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
      const result = await service.create(
        { duration: 'unlimited' } as any,
        mockAuthUser,
      );
      /* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(gameModel.create).toHaveBeenCalled();
      expect(result).toEqual(mockNewGame);
    });
  });

  describe(GameService.prototype.findAll.name, () => {
    it('should return a list of games with total count using skip and limit', async () => {
      const mockGames = [{ _id: '1' }, { _id: '2' }];

      const mockFind = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockGames),
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
  });

  describe(GameService.prototype.findOne.name, () => {
    it('should return a game by id', async () => {
      const mockGame = { _id: 'game1', fen: new Chess().fen() };
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
      const mockQuery = {
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockGame),
        }),
      };
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
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

  describe(GameService.prototype.update.name, () => {
    it('should return a string with the updated game id', () => {
      const dto = new UpdateGameDto();
      const result = service.update('game1', dto);
      expect(result).toBe('This action updates a #game1 game');
    });
  });

  describe(GameService.prototype.getBoard.name, () => {
    it('should throw NotFoundException if game not found', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue(null);
      await expect(service.getBoard('1')).rejects.toThrow(NotFoundException);
    });

    it('should return board and fen', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockResolvedValue({ fen: new Chess().fen() });
      const result = await service.getBoard('1');
      expect(result).toHaveProperty('fen');
      expect(result).toHaveProperty('board');
    });

    it('should throw BadRequestException if FEN is invalid', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockResolvedValue({ fen: 'invalid-fen' });
      await expect(service.getBoard('1')).rejects.toThrow(BadRequestException);
    });
  });

  describe(GameService.prototype.getMoves.name, () => {
    it('should throw NotFoundException if game not found', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue(null);
      await expect(service.getMoves('1')).rejects.toThrow(NotFoundException);
    });

    it('should return available moves', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockResolvedValue({ fen: new Chess().fen() });
      const moves = await service.getMoves('1');
      expect(Array.isArray(moves)).toBeTruthy();
      expect(moves.length).toBeGreaterThan(0);
    });

    it('should throw BadRequestException if FEN is invalid', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockResolvedValue({ fen: 'invalid-fen' });
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
  });
});
