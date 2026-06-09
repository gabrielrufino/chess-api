import { Test, TestingModule } from '@nestjs/testing';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { AuthGuard } from '../auth/auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';

describe(PlayerController.name, () => {
  let controller: PlayerController;
  let service: PlayerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlayerController],
      providers: [
        {
          provide: PlayerService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {}, // Needed for AuthGuard if it depends on it, otherwise mock AuthGuard directly
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => true,
      })
      .compile();

    controller = module.get<PlayerController>(PlayerController);
    service = module.get<PlayerService>(PlayerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a player', async () => {
    const createPlayerDto = { nickname: 'test' };
    const request = { user: { sub: 'user-id', isGuest: true, username: 'test' } };
    jest.spyOn(service, 'create').mockResolvedValue(createPlayerDto as any);

    const result = await controller.create(request, createPlayerDto as any);

    expect(service.create).toHaveBeenCalledWith(createPlayerDto, request.user);
    expect(result).toEqual(createPlayerDto);
  });

  it('should find all players', async () => {
    const players = { data: [{ id: '1', nickname: 'test' }], total: 1 };
    jest.spyOn(service, 'findAll').mockResolvedValue(players as any);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual(players);
  });

  it('should find one player', async () => {
    const player = { id: '1', nickname: 'test' };
    jest.spyOn(service, 'findOne').mockResolvedValue(player as any);

    const result = await controller.findOne('1');

    expect(service.findOne).toHaveBeenCalledWith('1');
    expect(result).toEqual(player);
  });

  it('should update a player', async () => {
    jest.spyOn(service, 'update').mockResolvedValue('This action updates a #1 player' as any);

    const result = await controller.update('1', { nickname: 'new-test' } as any);

    expect(service.update).toHaveBeenCalledWith('1', { nickname: 'new-test' });
    expect(result).toEqual('This action updates a #1 player');
  });

  it('should remove a player', async () => {
    jest.spyOn(service, 'remove').mockResolvedValue({ affected: 1 } as any);

    const result = await controller.remove('1');

    expect(service.remove).toHaveBeenCalledWith('1');
    expect(result).toEqual({ affected: 1 });
  });
});
