import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { GameController } from './game.controller';
import { GameService } from '../services/game.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { GameDurationEnum } from '../enumerables/game-duration.enum';

describe(GameController.name, () => {
  let controller: GameController;
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        {
          provide: GameService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            getBoard: jest.fn(),
            getMoves: jest.fn(),
            makeMove: jest.fn(),
            getDurations: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {},
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<GameController>(GameController);
    service = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get board', async () => {
    const boardResult = { fen: 'test-fen', board: [] };
    jest.spyOn(service, 'getBoard').mockResolvedValue(boardResult);

    const result = await controller.getBoard('1');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.getBoard).toHaveBeenCalledWith('1');
    expect(result).toEqual(boardResult);
  });

  it('should get moves', async () => {
    const movesResult = ['e4', 'd4'];
    jest.spyOn(service, 'getMoves').mockResolvedValue(movesResult);

    const result = await controller.getMoves('1');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.getMoves).toHaveBeenCalledWith('1');
    expect(result).toEqual(movesResult);
  });

  it('should make move', async () => {
    const request = { user: { sub: 'user-id' } };
    const createMoveDto = { move: 'e4' };
    jest.spyOn(service, 'makeMove').mockResolvedValue({ id: '1' } as any);

    const result = await controller.makeMove(
      request as any,
      '1',
      createMoveDto,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.makeMove).toHaveBeenCalledWith(
      '1',
      createMoveDto,
      request.user,
    );
    expect(result).toEqual({ id: '1' });
  });

  it('should get durations', () => {
    const durationsResult = [
      { value: GameDurationEnum.FiveMinutes, label: '5 minutes' },
    ];
    jest.spyOn(service, 'getDurations').mockReturnValue(durationsResult);

    const result = controller.getDurations();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.getDurations).toHaveBeenCalled();
    expect(result).toEqual(durationsResult);
  });
});
