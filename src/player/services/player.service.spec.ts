import { Test, TestingModule } from '@nestjs/testing';
import { PlayerService } from './player.service';
import { getModelToken } from '@nestjs/mongoose';
import { Player } from '../schemas/player.schema';
import { Model } from 'mongoose';
import { NicknameAlreadyTakenException } from '../exceptions/nickname-already-taken.exception';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

describe(PlayerService.name, () => {
  let service: PlayerService;
  let repository: Model<Player>;
  let cacheManager: Cache;

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
            findOneAndUpdate: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        PlayerService,
      ],
    }).compile();

    service = module.get<PlayerService>(PlayerService);
    repository = module.get<Model<Player>>(getModelToken(Player.name));
    cacheManager = module.get<Cache>(CACHE_MANAGER);
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

      expect(cacheManager.del).toHaveBeenCalledWith(
        `nickname-reserve:${createDto.nickname}`,
      );
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

  describe('removeIfOwner', () => {
    it('should soft-delete and return the player when it belongs to the user', async () => {
      const deletedAt = new Date();
      const mockPlayer = { _id: '1', userId: 'user-id', deletedAt };
      jest.spyOn(repository, 'findOneAndUpdate').mockResolvedValue(mockPlayer);

      const result = await service.removeIfOwner('1', 'user-id');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: '1', userId: 'user-id', deletedAt: null },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { deletedAt: expect.any(Date) },
        { new: true },
      );
      expect(result).toEqual(mockPlayer);
    });

    it('should return null when player does not belong to the user', async () => {
      jest.spyOn(repository, 'findOneAndUpdate').mockResolvedValue(null);

      const result = await service.removeIfOwner('1', 'another-user-id');

      expect(result).toBeNull();
    });

    it('should return null when player does not exist', async () => {
      jest.spyOn(repository, 'findOneAndUpdate').mockResolvedValue(null);

      const result = await service.removeIfOwner('non-existent-id', 'user-id');

      expect(result).toBeNull();
    });
  });

  describe('suggestNickname', () => {
    const authUser = { sub: 'user-id', isGuest: true };

    it('should return a nickname that is not already taken and reserve it', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await service.suggestNickname(authUser as any);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `nickname-reserve:${result}`,
        authUser.sub,
        300000,
      );
    });

    it('should skip candidates that are reserved in cache', async () => {
      jest
        .spyOn(cacheManager, 'get')
        .mockResolvedValueOnce('other-user-id') // first candidate reserved by another user
        .mockResolvedValue(null); // second candidate available
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await service.suggestNickname(authUser as any);

      // Verify the second call resolved the available nickname

      expect(cacheManager.get).toHaveBeenCalledWith(
        `nickname-reserve:${result}`,
      );
      expect(typeof result).toBe('string');
    });

    it('should retry and return a different nickname when first candidates are taken', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        // First 3 attempts return existing player, 4th returns null
        .mockResolvedValueOnce({ nickname: 'taken1' } as any)
        .mockResolvedValueOnce({ nickname: 'taken2' } as any)
        .mockResolvedValueOnce({ nickname: 'taken3' } as any)
        .mockResolvedValueOnce(null);

      const result = await service.suggestNickname(authUser as any);

      expect(findOneSpy).toHaveBeenCalledTimes(4);
      expect(typeof result).toBe('string');
    });
  });

  describe('dismissNicknameReservation', () => {
    it('should delete the reservation when caller is the owner', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue('user-id');

      await service.dismissNicknameReservation('some-nickname', 'user-id');

      expect(cacheManager.del).toHaveBeenCalledWith(
        'nickname-reserve:some-nickname',
      );
    });

    it('should delete the reservation when no owner is stored (cache miss)', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

      await service.dismissNicknameReservation('some-nickname', 'user-id');

      expect(cacheManager.del).toHaveBeenCalledWith(
        'nickname-reserve:some-nickname',
      );
    });

    it('should NOT delete the reservation when caller is not the owner', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue('other-user-id');

      await service.dismissNicknameReservation('some-nickname', 'user-id');

      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });

  describe('updateIfOwner', () => {
    it('should update and return the player when it belongs to the user', async () => {
      const updatedPlayer = {
        _id: '1',
        userId: 'user-id',
        nickname: 'NewNick1234',
      };
      jest
        .spyOn(repository, 'findOneAndUpdate')
        .mockResolvedValue(updatedPlayer);

      const result = await service.updateIfOwner('1', 'user-id', {
        nickname: 'NewNick1234',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: '1', userId: 'user-id', deletedAt: null },
        { $set: { nickname: 'NewNick1234' } },
        { new: true, runValidators: true },
      );

      expect(cacheManager.del).toHaveBeenCalledWith(
        'nickname-reserve:NewNick1234',
      );
      expect(result).toEqual(updatedPlayer);
    });

    it('should return null when player does not belong to the user', async () => {
      jest.spyOn(repository, 'findOneAndUpdate').mockResolvedValue(null);

      const result = await service.updateIfOwner('1', 'another-user-id', {
        nickname: 'NewNick1234',
      });

      expect(result).toBeNull();
    });

    it('should return null when player does not exist', async () => {
      jest.spyOn(repository, 'findOneAndUpdate').mockResolvedValue(null);

      const result = await service.updateIfOwner('non-existent-id', 'user-id', {
        nickname: 'NewNick1234',
      });

      expect(result).toBeNull();
    });

    it('should throw NicknameAlreadyTakenException on MongoDB duplicate key error', async () => {
      jest
        .spyOn(repository, 'findOneAndUpdate')
        .mockRejectedValue({ code: 11000 });

      await expect(
        service.updateIfOwner('1', 'user-id', { nickname: 'TakenNick1234' }),
      ).rejects.toThrow(NicknameAlreadyTakenException);
    });
  });
});
