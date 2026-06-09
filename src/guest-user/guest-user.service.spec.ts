import { Test, TestingModule } from '@nestjs/testing';
import { GuestUserService } from './guest-user.service';
import { AuthService } from '../auth/auth.service';

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-uuid'),
}));

describe(GuestUserService.name, () => {
  let service: GuestUserService;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestUserService,
        {
          provide: AuthService,
          useValue: {
            createGuestToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GuestUserService>(GuestUserService);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a guest user and return a token', async () => {
    const createGuestUserDto = { name: 'Guest' };
    jest.spyOn(authService, 'createGuestToken').mockResolvedValue('mock-token');

    const result = await service.createGuestUser(createGuestUserDto);

    expect(authService.createGuestToken).toHaveBeenCalledWith({
      id: 'mock-uuid',
      name: 'Guest',
    });
    expect(result).toEqual({
      id: 'mock-uuid',
      name: 'Guest',
      token: 'mock-token',
    });
  });
});
