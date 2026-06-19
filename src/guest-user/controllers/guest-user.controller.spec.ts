import { Test, TestingModule } from '@nestjs/testing';
import { GuestUserController } from './guest-user.controller';
import { GuestUserService } from '../services/guest-user.service';
import { CreateGuestUserDto } from '../dto/create-guest-user.dto';
import { GuestUserDto } from '../dto/guest-user-response.dto';

describe(GuestUserController.name, () => {
  let controller: GuestUserController;
  let service: jest.Mocked<GuestUserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: GuestUserService,
          useValue: {
            createGuestUser: jest.fn(),
          },
        },
      ],
      controllers: [GuestUserController],
    }).compile();

    controller = module.get<GuestUserController>(GuestUserController);
    service = module.get(GuestUserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createGuestUser', () => {
    it('should successfully create a guest user and return a GuestUserDto', async () => {
      const createGuestUserDto: CreateGuestUserDto = {
        name: 'Guest123',
      };
      const expectedId = 'uuid-1234';
      const expectedToken = 'token.123';

      const mockServiceResponse = {
        id: expectedId,
        name: 'Guest123',
        token: expectedToken,
      };

      const createGuestUserSpy = jest
        .spyOn(service, 'createGuestUser')
        .mockResolvedValue(mockServiceResponse as any);

      const result = await controller.createGuestUser(createGuestUserDto);

      expect(createGuestUserSpy).toHaveBeenCalledWith(createGuestUserDto);
      expect(result).toBeInstanceOf(GuestUserDto);
      expect(result).toEqual({
        id: expectedId,
        name: 'Guest123',
        token: expectedToken,
      });
    });
  });
});
