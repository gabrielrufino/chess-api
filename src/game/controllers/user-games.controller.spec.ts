import { Test, TestingModule } from '@nestjs/testing';
import { UserGamesController } from './user-games.controller';
import { GameService } from '../services/game.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AuthRequest } from '../../auth/interfaces/auth-user.interface';
import { StreamableFile } from '@nestjs/common';

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

      const result = await controller.exportGames(
        request as unknown as AuthRequest,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(gameService.exportUserGamesToCsv).toHaveBeenCalledWith(
        request.user,
      );

      expect(result).toBeInstanceOf(StreamableFile);
    });
  });
});
