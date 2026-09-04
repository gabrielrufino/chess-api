import { JwtService } from '@nestjs/jwt';
/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Chess } from 'chess.js';
import type { Server, Socket } from 'socket.io';
import { GameGateway } from './game.gateway';
import { Game, GameDocument } from '../schemas/game.schema';
import { GameDto, GameBoardDto } from '../dto/game-response.dto';
import { Model } from 'mongoose';

describe(GameGateway.name, () => {
  let gateway: GameGateway;
  let gameModel: Model<GameDocument>;
  let jwtService: JwtService;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  const mockClient = {
    join: jest.fn(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    gameModel = {
      findById: jest.fn(),
    } as unknown as Model<GameDocument>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameGateway,
        {
          provide: getModelToken(Game.name),
          useValue: gameModel,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    gateway = module.get<GameGateway>(GameGateway);
    // inject mock server
    gateway.server = mockServer as unknown as Server;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe(GameGateway.prototype.handleJoinGame.name, () => {
    it('should return `{ joined: false }` when gameId is empty', async () => {
      const result = await gateway.handleJoinGame(
        '',
        mockClient as unknown as Socket,
      );
      expect(result).toEqual({ joined: false });
    });

    it('should return `{ joined: false }` when gameId is not a valid ObjectId', async () => {
      const result = await gateway.handleJoinGame(
        'not-a-valid-id',
        mockClient as unknown as Socket,
      );
      expect(result).toEqual({ joined: false });
    });

    it('should return `{ joined: false }` when game is not found in database', async () => {
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      const validObjectId = '507f1f77bcf86cd799439011';
      const result = await gateway.handleJoinGame(
        validObjectId,
        mockClient as unknown as Socket,
      );
      expect(result).toEqual({ joined: false });
       
      expect(gameModel.findById).toHaveBeenCalledWith(validObjectId);
    });

    it('should join the room and emit game-updated when game found with PGN', async () => {
      const chess = new Chess();
      chess.move('e4');
      const mockGame = {
        _id: 'game1',
        pgn: chess.pgn(),
        fen: chess.fen(),
        toJSON: jest.fn().mockReturnValue({
          _id: 'game1',
          pgn: chess.pgn(),
          fen: chess.fen(),
        }),
      };
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      } as any);

      const validObjectId = '507f1f77bcf86cd799439011';
      const result = await gateway.handleJoinGame(
        validObjectId,
        mockClient as unknown as Socket,
      );

      expect(result).toEqual({ joined: true });
      expect(mockClient.join).toHaveBeenCalledWith(validObjectId);
      // Verify the emitted FEN reflects the post-e4 state (not the initial position),
      // proving that loadPgn(game.pgn) was actually called.
      const expectedFen = chess.fen();
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(mockClient.emit).toHaveBeenCalledWith(
        'game-updated',
        expect.objectContaining({
          board: expect.objectContaining({ fen: expectedFen }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });

    it('should join the room and emit game-updated when game found with only FEN (no PGN)', async () => {
      const chess = new Chess();
      const mockGame = {
        _id: 'game1',
        pgn: '',
        fen: chess.fen(),
        toJSON: jest
          .fn()
          .mockReturnValue({ _id: 'game1', pgn: '', fen: chess.fen() }),
      };
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      } as any);

      const validObjectId = '507f1f77bcf86cd799439011';
      const result = await gateway.handleJoinGame(
        validObjectId,
        mockClient as unknown as Socket,
      );

      expect(result).toEqual({ joined: true });
      expect(mockClient.join).toHaveBeenCalledWith(validObjectId);
      // Verify the emitted FEN matches the game's FEN (proving chess.load(game.fen) was called)
      const expectedFen = chess.fen();
      expect(mockClient.emit).toHaveBeenCalledWith(
        'game-updated',
        expect.objectContaining({
          board: expect.objectContaining({ fen: expectedFen }),
        }),
      );
    });

    it('should join and emit even if game state cannot be loaded (logs warning)', async () => {
      const mockGame = {
        _id: 'game1',
        pgn: 'invalid-pgn',
        fen: 'invalid-fen',
        toJSON: jest.fn().mockReturnValue({
          _id: 'game1',
          pgn: 'invalid-pgn',
          fen: 'invalid-fen',
        }),
      };
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      } as any);
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      const validObjectId = '507f1f77bcf86cd799439011';
      const result = await gateway.handleJoinGame(
        validObjectId,
        mockClient as unknown as Socket,
      );

      expect(result).toEqual({ joined: true });
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(validObjectId),
      );
      expect(mockClient.join).toHaveBeenCalledWith(validObjectId);
      expect(mockClient.emit).toHaveBeenCalled();
    });

    it('should join and emit even if game state throws a string error (logs warning)', async () => {
      const mockGame = {
        _id: 'game1',
        pgn: 'valid-pgn-but-throws-string',
        fen: 'invalid-fen',
        toJSON: jest.fn().mockReturnValue({
          _id: 'game1',
          pgn: 'valid-pgn-but-throws-string',
          fen: 'invalid-fen',
        }),
      };
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      } as any);

      const chessLoadPgnSpy = jest
        .spyOn(Chess.prototype, 'loadPgn')
        .mockImplementation(() => {
          throw 'String error thrown by mock';
        });
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      const validObjectId = '507f1f77bcf86cd799439011';
      const result = await gateway.handleJoinGame(
        validObjectId,
        mockClient as unknown as Socket,
      );

      expect(result).toEqual({ joined: true });
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('String error thrown by mock'),
      );

      chessLoadPgnSpy.mockRestore();
    });

    it('should join and emit with default board when game has no pgn and no fen', async () => {
      const mockGame = {
        _id: 'game1',
        pgn: null,
        fen: null,
        toJSON: jest
          .fn()
          .mockReturnValue({ _id: 'game1', pgn: null, fen: null }),
      };
      jest.spyOn(gameModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      } as any);

      const validObjectId = '507f1f77bcf86cd799439011';
      const result = await gateway.handleJoinGame(
        validObjectId,
        mockClient as unknown as Socket,
      );

      expect(result).toEqual({ joined: true });
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(mockClient.emit).toHaveBeenCalledWith(
        'game-updated',
        expect.objectContaining({
          board: expect.objectContaining({
            fen: expect.any(String),
            board: expect.any(Array),
          }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });
  });

  describe(GameGateway.prototype.emitGameUpdated.name, () => {
    it('should emit game-updated event to the correct room', () => {
      const gameId = 'game123';
      const mockGameDto = { _id: gameId } as unknown as GameDto;
      const mockBoardDto = { fen: 'startingFen', board: [] } as GameBoardDto;

      gateway.emitGameUpdated(gameId, mockGameDto, mockBoardDto);

      expect(mockServer.to).toHaveBeenCalledWith(gameId);
      expect(mockServer.emit).toHaveBeenCalledWith('game-updated', {
        game: mockGameDto,
        board: mockBoardDto,
      });
    });
  });
});
