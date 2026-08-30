import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './game.service';
import { getModelToken } from '@nestjs/mongoose';
import { Game } from '../schemas/game.schema';
import { Player } from '../../player/schemas/player.schema';
import { GameGateway } from '../gateways/game.gateway';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { NotFoundException } from '@nestjs/common';

describe('GameService exportUserGamesToCsv', () => {
  let service: GameService;
  let playerModel: any;
  let gameModel: any;

  beforeEach(async () => {
    playerModel = {
      findOne: jest.fn(),
    };
    gameModel = {
      find: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: getModelToken(Game.name), useValue: gameModel },
        { provide: getModelToken(Player.name), useValue: playerModel },
        { provide: GameGateway, useValue: {} },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  it('should throw NotFoundException if player not found', async () => {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    playerModel.findOne.mockResolvedValue(null);
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    await expect(
      service.exportUserGamesToCsv({ sub: 'user1' } as AuthUser),
    ).rejects.toThrow(NotFoundException);
  });

  it('should export user games to CSV correctly', async () => {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    const mockPlayer = { _id: 'player1' };
    playerModel.findOne.mockResolvedValue(mockPlayer);
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

    const mockGames = [
      {
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        whitePlayer: { nickname: 'p1' },
        blackPlayer: { nickname: 'p2' },
        status: 'CHECKMATE',
        pgn: '[Event "Test Game"]\n1. e4',
        createdAt: new Date('2023-10-10T10:00:00Z'),
      },
      {
        whitePlayerId: 'player3',
        blackPlayerId: 'player1',
        whitePlayer: { nickname: 'p3' },
        blackPlayer: { nickname: 'p1' },
        status: 'DRAW',
        pgn: '1. d4',
        createdAt: new Date('2023-10-11T10:00:00Z'),
      },
    ];

    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    gameModel.lean.mockResolvedValue(mockGames);

    const csv = await service.exportUserGamesToCsv({
      sub: 'user1',
    } as AuthUser);
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

    expect(csv).toContain('Data,Adversario,Cor,Resultado,PGN');
    expect(csv).toContain(
      '2023-10-10T10:00:00.000Z,"p2",White,CHECKMATE,"[Event ""Test Game""]\n1. e4"',
    );
    expect(csv).toContain('2023-10-11T10:00:00.000Z,"p3",Black,DRAW,"1. d4"');
  });
});
