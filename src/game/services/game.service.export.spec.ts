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
    ).rejects.toThrow(new NotFoundException('Player not found'));
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    expect(playerModel.findOne).toHaveBeenCalledWith({ userId: 'user1' });
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
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

    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    expect(playerModel.findOne).toHaveBeenCalledWith({ userId: 'user1' });
    expect(gameModel.find).toHaveBeenCalledWith({
      $or: [{ whitePlayerId: 'player1' }, { blackPlayerId: 'player1' }],
    });
    expect(gameModel.populate).toHaveBeenCalledWith('whitePlayer');
    expect(gameModel.populate).toHaveBeenCalledWith('blackPlayer');
    expect(gameModel.sort).toHaveBeenCalledWith({ createdAt: -1 });
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */

    expect(csv).toBe(
      'Data,Adversario,Cor,Resultado,PGN\n' +
        '2023-10-10T10:00:00.000Z,"p2",White,CHECKMATE,"[Event ""Test Game""]\n1. e4"\n' +
        '2023-10-11T10:00:00.000Z,"p3",Black,DRAW,"1. d4"',
    );
  });

  it('should neutralize formula prefixes and handle quotes and missing fields in CSV export', async () => {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    const mockPlayer = { _id: 'player1' };
    playerModel.findOne.mockResolvedValue(mockPlayer);

    const mockGames = [
      {
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        whitePlayer: { nickname: 'p1' },
        blackPlayer: { nickname: '-1+1' },
        status: 'RESIGNED',
        pgn: null,
        createdAt: null,
      },
      {
        whitePlayerId: 'player3',
        blackPlayerId: 'player1',
        whitePlayer: { nickname: '=CMD|calc' },
        blackPlayer: { nickname: 'p1' },
        status: 'RESIGNED',
        pgn: '1. e4',
        createdAt: new Date('2023-10-12T10:00:00Z'),
      },
      {
        whitePlayerId: 'player1',
        blackPlayerId: 'player4',
        whitePlayer: { nickname: 'p1' },
        blackPlayer: { nickname: '+formula' },
        status: 'RESIGNED',
        pgn: '1. e4',
        createdAt: new Date('2023-10-12T10:00:00Z'),
      },
      {
        whitePlayerId: 'player1',
        blackPlayerId: 'player5',
        whitePlayer: { nickname: 'p1' },
        blackPlayer: { nickname: '@admin' },
        status: 'RESIGNED',
        pgn: '1. e4',
        createdAt: new Date('2023-10-12T10:00:00Z'),
      },
      {
        whitePlayerId: 'player1',
        blackPlayerId: 'player6',
        whitePlayer: { nickname: 'p1' },
        blackPlayer: { nickname: '\ttabbed' },
        status: 'RESIGNED',
        pgn: '1. e4',
        createdAt: new Date('2023-10-12T10:00:00Z'),
      },
      {
        whitePlayerId: 'player1',
        blackPlayerId: 'player7',
        whitePlayer: { nickname: 'p1' },
        blackPlayer: { nickname: '\rreturn' },
        status: 'RESIGNED',
        pgn: '1. e4',
        createdAt: new Date('2023-10-12T10:00:00Z'),
      },
      {
        whitePlayerId: 'player1',
        blackPlayerId: 'player8',
        whitePlayer: { nickname: 'p1' },
        blackPlayer: { nickname: 'John "The Great" Doe' },
        status: 'RESIGNED',
        pgn: '1. e4',
        createdAt: new Date('2023-10-12T10:00:00Z'),
      },
      {
        whitePlayerId: 'player1',
        blackPlayerId: 'player9',
        whitePlayer: { nickname: 'p1' },
        blackPlayer: null,
        status: 'RESIGNED',
        pgn: '',
        createdAt: new Date('2023-10-12T10:00:00Z'),
      },
      {
        whitePlayerId: null,
        blackPlayerId: 'player1',
        whitePlayer: null,
        blackPlayer: { nickname: 'p1' },
        status: 'RESIGNED',
        pgn: undefined,
        createdAt: undefined,
      },
      {
        whitePlayerId: undefined,
        blackPlayerId: 'player1',
        whitePlayer: { nickname: undefined },
        blackPlayer: { nickname: 'p1' },
        status: 'RESIGNED',
        pgn: undefined,
        createdAt: undefined,
      },
    ];

    gameModel.lean.mockResolvedValue(mockGames);

    const csv = await service.exportUserGamesToCsv({
      sub: 'user1',
    } as AuthUser);
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

    const lines = csv.split('\n');
    expect(lines[1]).toBe(',"\'-1+1",White,RESIGNED,""');
    expect(lines[1].split(',')[0]).toBe('');
    expect(lines[2]).toBe(
      '2023-10-12T10:00:00.000Z,"\'=CMD|calc",Black,RESIGNED,"1. e4"',
    );
    expect(lines[3]).toBe(
      '2023-10-12T10:00:00.000Z,"\'+formula",White,RESIGNED,"1. e4"',
    );
    expect(lines[4]).toBe(
      '2023-10-12T10:00:00.000Z,"\'@admin",White,RESIGNED,"1. e4"',
    );
    expect(lines[5]).toBe(
      '2023-10-12T10:00:00.000Z,"\'\ttabbed",White,RESIGNED,"1. e4"',
    );
    expect(lines[6]).toBe(
      '2023-10-12T10:00:00.000Z,"\'\rreturn",White,RESIGNED,"1. e4"',
    );
    expect(lines[7]).toBe(
      '2023-10-12T10:00:00.000Z,"John ""The Great"" Doe",White,RESIGNED,"1. e4"',
    );
    expect(lines[8]).toBe(
      '2023-10-12T10:00:00.000Z,"Desconhecido",White,RESIGNED,""',
    );
    expect(lines[9]).toBe(',"Desconhecido",Black,RESIGNED,""');
    expect(lines[10]).toBe(',"Desconhecido",Black,RESIGNED,""');
  });
});
