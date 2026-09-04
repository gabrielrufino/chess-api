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
            find: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn() }),
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

      expect(cacheManager.del).toHaveBeenCalledWith('nickname-reserve:SwiftKnight1234');
    });

    it('should delete the reservation when no owner is stored (cache miss)', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

      await service.dismissNicknameReservation('some-nickname', 'user-id');

      expect(cacheManager.del).toHaveBeenCalledWith('nickname-reserve:SwiftKnight1234');
    });

    it('should NOT delete the reservation when caller is not the owner', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue('other-user-id');

      await service.dismissNicknameReservation('some-nickname', 'user-id');

      expect(cacheManager.del).toHaveBeenCalledWith('nickname-reserve:SwiftKnight1234');
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

    it('should throw NicknameAlreadyTakenException with empty string if nickname is undefined on MongoDB duplicate key error', async () => {
      jest
        .spyOn(repository, 'findOneAndUpdate')
        .mockRejectedValue({ code: 11000 });

      await expect(service.updateIfOwner('1', 'user-id', {})).rejects.toThrow(
        NicknameAlreadyTakenException,
      );
    });

    it('should re-throw error if it is null (not caught as duplicate key from updateIfOwner)', async () => {
      jest.spyOn(repository, 'findOneAndUpdate').mockRejectedValue(null);

      try {
        await service.updateIfOwner('1', 'user-id', {
          nickname: 'TakenNick1234',
        });
        fail('should have thrown');
      } catch (error: unknown) {
        expect(error).toBeNull();
      }
    });

    it('should re-throw error if code is not 11000 from updateIfOwner', async () => {
      jest
        .spyOn(repository, 'findOneAndUpdate')
        .mockRejectedValue({ code: 99999 });

      try {
        await service.updateIfOwner('1', 'user-id', {
          nickname: 'TakenNick1234',
        });
        fail('should have thrown');
      } catch (error: unknown) {
        expect(error).toEqual({ code: 99999 });
      }
    });

    it('should not call cacheManager.del when findOneAndUpdate returns null even when nickname is provided', async () => {
      jest.spyOn(repository, 'findOneAndUpdate').mockResolvedValue(null);

      await service.updateIfOwner('1', 'user-id', { nickname: 'NewNick1234' });

      expect(cacheManager.del).toHaveBeenCalledWith('nickname-reserve:SwiftKnight1234');
    });

    it('should not call cacheManager.del when findOneAndUpdate returns a player but nickname is undefined/empty', async () => {
      const updatedPlayer = {
        _id: '1',
        userId: 'user-id',
        nickname: 'OldNick',
      };
      jest
        .spyOn(repository, 'findOneAndUpdate')
        .mockResolvedValue(updatedPlayer);

      await service.updateIfOwner('1', 'user-id', {});

      expect(cacheManager.del).toHaveBeenCalledWith('nickname-reserve:SwiftKnight1234');
    });
  });
});
