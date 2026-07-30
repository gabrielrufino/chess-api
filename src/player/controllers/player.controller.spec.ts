import { Test, TestingModule } from '@nestjs/testing';
import { PlayerController } from './player.controller';
import { PlayerService } from '../services/player.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { JwtService } from '@nestjs/jwt';
import { NicknameAlreadyTakenException } from '../exceptions/nickname-already-taken.exception';

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
            remove: jest.fn(),
            removeIfOwner: jest.fn(),
            updateIfOwner: jest.fn(),
            suggestNickname: jest.fn(),
            dismissNicknameReservation: jest.fn(),
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
      const request = { user: { sub: 'user-id', isGuest: true } };
      jest.spyOn(service, 'suggestNickname').mockResolvedValue('BoldRook5678');

      const result = await controller.suggestNickname(request as any);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.suggestNickname).toHaveBeenCalledWith(request.user);
      expect(result).toEqual({ nickname: 'BoldRook5678' });
    });
  });

  describe('dismissNicknameReservation', () => {
    it('should dismiss a nickname suggestion', async () => {
      const request = { user: { sub: 'user-id' } };
      const nickname = 'BoldRook5678';
      await controller.dismissNicknameReservation(request as any, nickname);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.dismissNicknameReservation).toHaveBeenCalledWith(
        nickname,
        request.user.sub,
      );
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
    it('should update a player', async () => {
      const request = { user: { sub: 'user-id' } };
      const mockPlayer = {
        _id: '1',
        userId: 'user-id',
        nickname: 'NewNick1234',
        toJSON: () => ({ _id: '1', nickname: 'NewNick1234' }),
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockPlayer as any);
      jest.spyOn(service, 'updateIfOwner').mockResolvedValue(mockPlayer as any);

      const result = await controller.update(request as any, '1', {
        nickname: 'NewNick1234',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findOne).toHaveBeenCalledWith('1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.updateIfOwner).toHaveBeenCalledWith('1', 'user-id', {
        nickname: 'NewNick1234',
      });
      expect(result).toEqual(
        expect.objectContaining({ nickname: 'NewNick1234' }),
      );
    });

    it('should throw ForbiddenException if player does not belong to the user', async () => {
      const request = { user: { sub: 'another-user-id' } };
      const mockPlayer = { _id: '1', userId: 'user-id' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockPlayer as any);

      await expect(
        controller.update(request as any, '1', { nickname: 'NewNick1234' }),
      ).rejects.toThrow('You are not allowed to update this player');
    });

    it('should throw NotFoundException if player not found', async () => {
      const request = { user: { sub: 'user-id' } };
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(
        controller.update(request as any, '1', { nickname: 'NewNick1234' }),
      ).rejects.toThrow('Player with ID 1 not found');
    });

    it('should throw NotFoundException if player not found when updating (race condition)', async () => {
      const request = { user: { sub: 'user-id' } };
      const mockPlayer = { _id: '1', userId: 'user-id' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockPlayer as any);
      jest.spyOn(service, 'updateIfOwner').mockResolvedValue(null);

      await expect(
        controller.update(request as any, '1', { nickname: 'NewNick1234' }),
      ).rejects.toThrow('Player with ID 1 not found');
    });

    it('should throw NicknameAlreadyTakenException if nickname is already taken', async () => {
      const request = { user: { sub: 'user-id' } };
      const mockPlayer = { _id: '1', userId: 'user-id' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockPlayer as any);
      jest
        .spyOn(service, 'updateIfOwner')
        .mockRejectedValue(new NicknameAlreadyTakenException('TakenNick1234'));

      await expect(
        controller.update(request as any, '1', { nickname: 'TakenNick1234' }),
      ).rejects.toThrow(NicknameAlreadyTakenException);
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
      jest.spyOn(service, 'removeIfOwner').mockResolvedValue(mockPlayer as any);

      const result = await controller.remove(request as any, '1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findOne).toHaveBeenCalledWith('1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.removeIfOwner).toHaveBeenCalledWith('1', 'user-id');
      expect(result).toEqual(expect.objectContaining({ _id: '1' }));
    });

    it('should throw ForbiddenException if player does not belong to the user', async () => {
      const request = { user: { sub: 'another-user-id' } };
      const mockPlayer = { _id: '1', userId: 'user-id' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockPlayer as any);

      await expect(controller.remove(request as any, '1')).rejects.toThrow(
        'You are not allowed to delete this player',
      );
    });

    it('should throw NotFoundException if player not found initially', async () => {
      const request = { user: { sub: 'user-id' } };
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(controller.remove(request as any, '1')).rejects.toThrow(
        'Player with ID 1 not found',
      );
    });

    it('should throw NotFoundException if player not found when removing', async () => {
      const request = { user: { sub: 'user-id' } };
      const mockPlayer = { _id: '1', userId: 'user-id' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockPlayer as any);
      jest.spyOn(service, 'removeIfOwner').mockResolvedValue(null);

      await expect(controller.remove(request as any, '1')).rejects.toThrow(
        'Player with ID 1 not found',
      );
    });
  });
});
