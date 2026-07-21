import { Test, TestingModule } from '@nestjs/testing';
import { PlayerController } from './player.controller';
import { PlayerService } from '../services/player.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { JwtService } from '@nestjs/jwt';
import { NicknameAlreadyTakenException } from '../exceptions/nickname-already-taken.exception';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

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
            suggestNickname: jest.fn(),
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

    controller = module.get<PlayerController>(PlayerController);
    service = module.get<PlayerService>(PlayerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a player with a nickname', async () => {
      const request = {
        user: { sub: 'user-id', isGuest: true },
      };
      const createDto = { nickname: 'SwiftKnight1234' };
      const mockPlayer = {
        _id: '1',
        nickname: 'SwiftKnight1234',
        toJSON: () => ({ _id: '1', nickname: 'SwiftKnight1234' }),
      };
      jest.spyOn(service, 'create').mockResolvedValue(mockPlayer as any);

      const result = await controller.create(request as any, createDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.create).toHaveBeenCalledWith(request.user, createDto);
      expect(result).toEqual(
        expect.objectContaining({ _id: '1', nickname: 'SwiftKnight1234' }),
      );
    });

    it('should propagate NicknameAlreadyTakenException from service', async () => {
      const request = { user: { sub: 'user-id', isGuest: true } };
      const createDto = { nickname: 'TakenNickname' };
      jest
        .spyOn(service, 'create')
        .mockRejectedValue(new NicknameAlreadyTakenException('TakenNickname'));

      await expect(
        controller.create(request as any, createDto),
      ).rejects.toThrow(NicknameAlreadyTakenException);
    });
  });

  describe('findAll', () => {
    it('should find all players', async () => {
      const players = {
        data: [{ _id: '1', nickname: 'SwiftKnight1234' }],
        total: 1,
      };
      jest.spyOn(service, 'findAll').mockResolvedValue(players as any);

      const result = await controller.findAll({});

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(expect.objectContaining({ total: 1 }));
    });

    it('should pass nickname query param to service', async () => {
      const players = {
        data: [{ _id: '1', nickname: 'SwiftKnight1234' }],
        total: 1,
      };
      jest.spyOn(service, 'findAll').mockResolvedValue(players as any);

      await controller.findAll({ nickname: 'swift' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findAll).toHaveBeenCalledWith({ nickname: 'swift' });
    });
  });

  describe('suggestNickname', () => {
    it('should return a nickname suggestion', async () => {
      jest.spyOn(service, 'suggestNickname').mockResolvedValue('BoldRook5678');

      const result = await controller.suggestNickname();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.suggestNickname).toHaveBeenCalled();
      expect(result).toEqual({ nickname: 'BoldRook5678' });
    });
  });

  describe('findOne', () => {
    it('should find one player', async () => {
      const mockPlayer = { _id: '1', nickname: 'SwiftKnight1234' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockPlayer as any);

      const result = await controller.findOne('1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(result).toEqual(expect.objectContaining({ _id: '1' }));
    });

    it('should throw NotFoundException if player not found when finding one', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(controller.findOne('1')).rejects.toMatchObject({
        message: 'Player with ID 1 not found',
        status: 404,
      });
    });
  });

  describe('update', () => {
    it('should update a player', () => {
      jest
        .spyOn(service, 'update')
        .mockReturnValue('This action updates a #1 player');

      const result = controller.update('1', {});

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.update).toHaveBeenCalledWith('1');
      expect(result).toEqual('This action updates a #1 player');
    });
  });

  describe('remove', () => {
    it('should remove a player', async () => {
      const request = { user: { sub: 'user-id' } };
      const mockPlayer = {
        _id: '1',
        userId: 'user-id',
        toJSON: () => ({ _id: '1' }),
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockPlayer as any);
      jest.spyOn(service, 'remove').mockResolvedValue(mockPlayer as any);

      const result = await controller.remove(request as any, '1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findOne).toHaveBeenCalledWith('1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.remove).toHaveBeenCalledWith('1');
      expect(result).toEqual(expect.objectContaining({ _id: '1' }));
    });

    it('should throw ForbiddenException if player does not belong to the user', async () => {
      const request = { user: { sub: 'another-user-id' } };
      const mockPlayer = { _id: '1', userId: 'user-id' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockPlayer as any);

      await expect(controller.remove(request as any, '1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if player not found initially', async () => {
      const request = { user: { sub: 'user-id' } };
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(controller.remove(request as any, '1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if player not found when removing', async () => {
      const request = { user: { sub: 'user-id' } };
      const mockPlayer = { _id: '1', userId: 'user-id' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockPlayer as any);
      jest.spyOn(service, 'remove').mockResolvedValue(null);

      await expect(controller.remove(request as any, '1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
