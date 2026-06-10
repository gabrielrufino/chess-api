import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './game.service';
import { getModelToken } from '@nestjs/mongoose';
import { Player, PlayerDocument } from '../player/schemas/player.schema';
import { GameStatusEnum } from './enumerables/game-status.enum';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Chess } from 'chess.js';
import { Model } from 'mongoose';
import { Game, GameDocument } from './schemas/game.schema';

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
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
        service.makeMove('1', { move: 'e4' }, { sub: 'user1' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if game is not full', async () => {
      jest
        .spyOn(gameModel, 'findById')
        .mockResolvedValue({ whitePlayerId: 'player1' });
      await expect(
        service.makeMove('1', { move: 'e4' }, { sub: 'user1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if game is not in progress', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.WAITING_PLAYER,
      });
      await expect(
        service.makeMove('1', { move: 'e4' }, { sub: 'user1' } as any),
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
        service.makeMove('1', { move: 'e4' }, { sub: 'user1' } as any),
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
        service.makeMove('1', { move: 'e4' }, { sub: 'user1' } as any),
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
        service.makeMove('1', { move: 'invalid' }, { sub: 'user1' } as any),
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
      } as any);
      expect(result.fen).not.toBe(new Chess().fen());
      expect(mockSave).toHaveBeenCalled();
    });
  });
});
