import { Test, TestingModule } from '@nestjs/testing';
import { PlayerController } from './player.controller';
import { PlayerService } from '../services/player.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { JwtService } from '@nestjs/jwt';

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
        canActivate: () => true,
      })
      .compile();

    controller = module.get<PlayerController>(PlayerController);
    service = module.get<PlayerService>(PlayerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a player', async () => {
    const request = {
      user: { sub: 'user-id', isGuest: true, username: 'test' },
    };
    const mockPlayer = { _id: '1', toJSON: () => ({ _id: '1' }) };
    jest.spyOn(service, 'create').mockResolvedValue(mockPlayer as any);

    const result = await controller.create(request as any);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.create).toHaveBeenCalledWith(request.user);
    expect(result).toEqual(expect.objectContaining({ _id: '1' }));
  });

  it('should throw if playerService.create throws', async () => {
    const request = {
      user: { sub: 'user-id', isGuest: true, username: 'test' },
    };
    const error = new Error('Create failed');
    jest.spyOn(service, 'create').mockRejectedValue(error);

    await expect(controller.create(request as any)).rejects.toThrow(error);
  });

  it('should find all players', async () => {
    const players = {
      data: [{ _id: '1', nickname: 'test', toJSON: () => ({ _id: '1' }) }],
      total: 1,
    };
    jest.spyOn(service, 'findAll').mockResolvedValue(players as any);

    const result = await controller.findAll();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ total: 1 }));
  });

  it('should find one player', async () => {
    const mockPlayer = { _id: '1', toJSON: () => ({ _id: '1' }) };
    jest.spyOn(service, 'findOne').mockResolvedValue(mockPlayer as any);

    const result = await controller.findOne('1');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.findOne).toHaveBeenCalledWith('1');
    expect(result).toEqual(expect.objectContaining({ _id: '1' }));
  });

  it('should throw NotFoundException if player not found when finding one', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue(null as any);

    await expect(controller.findOne('1')).rejects.toThrow('Player with ID 1 not found');
  });

  it('should update a player', () => {
    jest
      .spyOn(service, 'update')
      .mockReturnValue('This action updates a #1 player');

    const result = controller.update('1', {
      nickname: 'new-test',
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.update).toHaveBeenCalledWith('1');
    expect(result).toEqual('This action updates a #1 player');
  });

  it('should remove a player', async () => {
    const mockPlayer = { _id: '1', toJSON: () => ({ _id: '1' }) };
    jest.spyOn(service, 'remove').mockResolvedValue(mockPlayer as any);

    const result = await controller.remove('1');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.remove).toHaveBeenCalledWith('1');
    expect(result).toEqual(expect.objectContaining({ _id: '1' }));
  });

  it('should throw NotFoundException if player not found when removing', async () => {
    jest.spyOn(service, 'remove').mockResolvedValue(null as any);

    await expect(controller.remove('1')).rejects.toThrow('Player with ID 1 not found');
  });
});
