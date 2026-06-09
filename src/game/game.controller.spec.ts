import { Test, TestingModule } from '@nestjs/testing';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { AuthGuard } from '../auth/auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';

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
        canActivate: (context: ExecutionContext) => true,
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
    jest.spyOn(service, 'getBoard').mockResolvedValue(boardResult as any);

    const result = await controller.getBoard('1');

    expect(service.getBoard).toHaveBeenCalledWith('1');
    expect(result).toEqual(boardResult);
  });

  it('should get moves', async () => {
    const movesResult = ['e4', 'd4'];
    jest.spyOn(service, 'getMoves').mockResolvedValue(movesResult as any);

    const result = await controller.getMoves('1');

    expect(service.getMoves).toHaveBeenCalledWith('1');
    expect(result).toEqual(movesResult);
  });

  it('should make move', async () => {
    const request = { user: { sub: 'user-id' } };
    const createMoveDto = { move: 'e4' };
    jest.spyOn(service, 'makeMove').mockResolvedValue({ id: '1' } as any);

    const result = await controller.makeMove(request, '1', createMoveDto);

    expect(service.makeMove).toHaveBeenCalledWith('1', createMoveDto, request.user);
    expect(result).toEqual({ id: '1' });
  });
});
