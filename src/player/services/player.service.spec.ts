import { Test, TestingModule } from '@nestjs/testing';
import { PlayerService } from './player.service';
import { getModelToken } from '@nestjs/mongoose';
import { Player } from '../schemas/player.schema';
import { Model } from 'mongoose';
import { NicknameAlreadyTakenException } from '../exceptions/nickname-already-taken.exception';

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
            findOne: jest.fn(),
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

  describe('create', () => {
    it('should create a player with a nickname', async () => {
      const authUser = { sub: 'user-id', isGuest: true };
      const createDto = { nickname: 'SwiftKnight1234' };
      const mockPlayer = {
        userId: authUser.sub,
        isGuest: authUser.isGuest,
        nickname: createDto.nickname,
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockResolvedValue(mockPlayer as any);

      const result = await service.create(authUser as any, createDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findOne).toHaveBeenCalledWith({
        nickname: createDto.nickname,
        deletedAt: null,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.create).toHaveBeenCalledWith({
        userId: authUser.sub,
        isGuest: authUser.isGuest,
        nickname: createDto.nickname,
      });
      expect(result).toEqual(mockPlayer);
    });

    it('should throw NicknameAlreadyTakenException when nickname is in use', async () => {
      const authUser = { sub: 'user-id', isGuest: true };
      const createDto = { nickname: 'TakenNickname' };

      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue({ nickname: 'TakenNickname' } as any);

      await expect(service.create(authUser as any, createDto)).rejects.toThrow(
        NicknameAlreadyTakenException,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should throw NicknameAlreadyTakenException on MongoDB duplicate key error (race condition)', async () => {
      const authUser = { sub: 'user-id', isGuest: true };
      const createDto = { nickname: 'RacedNickname' };

      // findOne returns null (passes the pre-check), but create fails with code 11000
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(repository, 'create')
        .mockRejectedValue({ code: 11000 } as any);

      await expect(service.create(authUser as any, createDto)).rejects.toThrow(
        NicknameAlreadyTakenException,
      );
    });

    it('should re-throw non-duplicate-key errors from create', async () => {
      const authUser = { sub: 'user-id', isGuest: true };
      const createDto = { nickname: 'SomeNickname' };
      const dbError = new Error('Connection lost');

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockRejectedValue(dbError);

      await expect(service.create(authUser as any, createDto)).rejects.toThrow(
        dbError,
      );
    });
  });

  describe('findAll', () => {
    it('should find all players without filter', async () => {
      const players = [{ id: '1', nickname: 'SwiftKnight1234' }];
      jest.spyOn(repository, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(repository, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(players),
      } as any);

      const result = await service.findAll();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.countDocuments).toHaveBeenCalledWith({
        deletedAt: null,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.find).toHaveBeenCalledWith({ deletedAt: null });
      expect(result).toEqual({ data: players, total: 1 });
    });

    it('should filter players by nickname (partial match)', async () => {
      const players = [{ id: '1', nickname: 'SwiftKnight1234' }];
      jest.spyOn(repository, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(repository, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(players),
      } as any);

      const result = await service.findAll({ nickname: 'swift' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.countDocuments).toHaveBeenCalledWith({
        deletedAt: null,
        nickname: { $regex: 'swift', $options: 'i' },
      });
      expect(result).toEqual({ data: players, total: 1 });
    });
  });

  describe('findOne', () => {
    it('should find one player', async () => {
      const player = { id: '1', nickname: 'SwiftKnight1234' };
      jest.spyOn(repository, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(player),
      } as any);

      const result = await service.findOne('1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual(player);
    });
  });

  describe('update', () => {
    it('should update a player', () => {
      const result = service.update('1');
      expect(result).toBe('This action updates a #1 player');
    });
  });

  describe('remove', () => {
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

  describe('suggestNickname', () => {
    it('should return a nickname that is not already taken', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await service.suggestNickname();

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should retry and return a different nickname when first candidates are taken', async () => {
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        // First 3 attempts return existing player, 4th returns null
        .mockResolvedValueOnce({ nickname: 'taken1' } as any)
        .mockResolvedValueOnce({ nickname: 'taken2' } as any)
        .mockResolvedValueOnce({ nickname: 'taken3' } as any)
        .mockResolvedValueOnce(null);

      const result = await service.suggestNickname();

      expect(findOneSpy).toHaveBeenCalledTimes(4);
      expect(typeof result).toBe('string');
    });
  });
});
