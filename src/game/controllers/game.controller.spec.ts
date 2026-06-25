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
            claimTimeout: jest.fn(),
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

  describe(GameController.prototype.create.name, () => {
    it('should create a game and return a GameDto', async () => {
      const request = { user: { sub: 'user-id' } };
      const createGameDto = { duration: GameDurationEnum.FiveMinutes };
      const mockGame = {
        _id: 'game1',
        toJSON: () => ({
          _id: 'game1',
          duration: GameDurationEnum.FiveMinutes,
        }),
      };
      jest.spyOn(service, 'create').mockResolvedValue(mockGame as any);

      const result = await controller.create(request as any, createGameDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.create).toHaveBeenCalledWith(createGameDto, request.user);
      expect(result).toEqual(expect.objectContaining({ _id: 'game1' }));
    });
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
    const mockGame = { _id: '1', toJSON: () => ({ _id: '1' }) };
    jest.spyOn(service, 'makeMove').mockResolvedValue(mockGame as any);

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
    expect(result).toEqual(expect.objectContaining({ _id: '1' }));
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

  it('should get all games with pagination', async () => {
    const paginationQuery = { skip: 0, limit: 10 };
    const mockGame = { _id: '1', toJSON: () => ({ _id: '1' }) };
    const mockResult = { data: [mockGame], total: 1 };

    jest.spyOn(service, 'findAll').mockResolvedValue(mockResult as any);

    const result = await controller.findAll(paginationQuery);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.findAll).toHaveBeenCalledWith(0, 10);
    expect(result.data).toBeDefined();
    expect(result.total).toBe(1);
  });

  describe(GameController.prototype.findOne.name, () => {
    it('should return a GameDto when game exists', async () => {
      const mockGame = { _id: 'game1', toJSON: () => ({ _id: 'game1' }) };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockGame as any);

      const result = await controller.findOne('game1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findOne).toHaveBeenCalledWith('game1');
      expect(result).toEqual(expect.objectContaining({ _id: 'game1' }));
    });

    it('should throw NotFoundException when game does not exist', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        'Game with ID nonexistent not found',
      );
    });
  });

  describe(GameController.prototype.update.name, () => {
    it('should return the update result string', () => {
      const updateResult = 'This action updates a #game1 game';
      jest.spyOn(service, 'update').mockReturnValue(updateResult);

      const result = controller.update('game1', {});

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.update).toHaveBeenCalledWith('game1', {});
      expect(result).toBe(updateResult);
    });
  });

  describe(GameController.prototype.claimTimeout.name, () => {
    it('should claim timeout and return a GameDto', async () => {
      const request = { user: { sub: 'user-id' } };
      const mockGame = { _id: 'game1', toJSON: () => ({ _id: 'game1' }) };
      jest.spyOn(service, 'claimTimeout').mockResolvedValue(mockGame as any);

      const result = await controller.claimTimeout(request as any, 'game1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.claimTimeout).toHaveBeenCalledWith('game1', request.user);
      expect(result).toEqual(expect.objectContaining({ _id: 'game1' }));
    });
  });
});
