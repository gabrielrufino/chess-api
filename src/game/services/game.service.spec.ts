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

describe(GameService.name, () => {
  let service: GameService;
  let gameModel: Model<GameDocument>;
  let playerModel: Model<PlayerDocument>;

  beforeEach(async () => {
    gameModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
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

  describe('getDurations', () => {
    it('should return an array of duration objects with values and labels', () => {
      const result = service.getDurations();
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('value');
      expect(result[0]).toHaveProperty('label');
    });
  });

  describe('findAll', () => {
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
        .spyOn(gameModel, 'countDocuments')
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

  describe('getBoard', () => {
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
  });

  describe('getMoves', () => {
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
  });

  describe('makeMove', () => {
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

    it('should throw BadRequestException if time is up for current player', async () => {
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
  });

  describe('claimTimeout', () => {
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

    it('should set status to TIMEOUT and save if time is up', async () => {
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
  });
});
