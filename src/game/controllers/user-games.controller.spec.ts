import { Test, TestingModule } from '@nestjs/testing';
import { UserGamesController } from './user-games.controller';
import { GameService } from '../services/game.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Response } from 'express';
import { AuthRequest } from '../../auth/interfaces/auth-user.interface';

describe('UserGamesController', () => {
  let controller: UserGamesController;
  let gameService: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserGamesController],
      providers: [
        {
          provide: GameService,
          useValue: {
            exportUserGamesToCsv: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserGamesController>(UserGamesController);
    gameService = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('exportGames', () => {
    it('should export user games as CSV', async () => {
      const mockCsvData =
        'Data,Adversário,Cor,Resultado,PGN\n2023-10-10,opponent1,White,WIN,1. e4';
      jest
        .spyOn(gameService, 'exportUserGamesToCsv')
        .mockResolvedValue(mockCsvData);

      const request = { user: { sub: 'user1' } };
      const response: Partial<Response> = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.exportGames(
        request as unknown as AuthRequest,
        response as unknown as Response,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(gameService.exportUserGamesToCsv).toHaveBeenCalledWith(
        request.user,
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="meu_historico_xadrez.csv"',
      );
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.send).toHaveBeenCalledWith(mockCsvData);
    });
  });
});
