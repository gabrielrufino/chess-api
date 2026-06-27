import { Test, TestingModule } from '@nestjs/testing';
import { PlayerService } from './player.service';
import { getModelToken } from '@nestjs/mongoose';
import { Player } from '../schemas/player.schema';
import { Model } from 'mongoose';

describe(PlayerService.name, () => {
  let service: PlayerService;
  let repository: Model<Player>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getModelToken(Player.name),
          useValue: {
            create: jest.fn(),
            countDocuments: jest.fn(),
            find: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
          },
        },
        PlayerService,
      ],
    }).compile();

    service = module.get<PlayerService>(PlayerService);
    repository = module.get<Model<Player>>(getModelToken(Player.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a player', async () => {
    const authUser = { sub: 'user-id', isGuest: true, username: 'test' };
    const mockPlayer = { userId: authUser.sub, isGuest: authUser.isGuest };

    jest.spyOn(repository, 'create').mockResolvedValue(mockPlayer as any);

    const result = await service.create(authUser as any);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.create).toHaveBeenCalledWith({
      userId: authUser.sub,
      isGuest: authUser.isGuest,
    });
    expect(result).toEqual(mockPlayer);
  });

  it('should find all players', async () => {
    const players = [{ id: '1', nickname: 'test' }];
    jest.spyOn(repository, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(repository, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(players),
    } as any);

    const result = await service.findAll();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.countDocuments).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.find).toHaveBeenCalled();
    expect(result).toEqual({ data: players, total: 1 });
  });

  it('should find one player', async () => {
    const player = { id: '1', nickname: 'test' };
    jest.spyOn(repository, 'findById').mockResolvedValue(player);

    const result = await service.findOne('1');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.findById).toHaveBeenCalledWith('1');
    expect(result).toEqual(player);
  });

  it('should update a player', () => {
    const result = service.update('1');
    expect(result).toBe('This action updates a #1 player');
  });

  it('should remove a player', async () => {
    jest
      .spyOn(repository, 'findByIdAndUpdate')
      .mockResolvedValue({ id: '1', deletedAt: new Date() });

    const result = await service.remove('1');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.findByIdAndUpdate).toHaveBeenCalledWith(
      '1',
      expect.any(Object),
      { new: true },
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    expect(result).toEqual({ id: '1', deletedAt: expect.any(Date) });
  });
});
