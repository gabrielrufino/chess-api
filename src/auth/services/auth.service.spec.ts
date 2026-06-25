import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

describe(AuthService.name, () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
          },
        },
        AuthService,
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService) as jest.Mocked<JwtService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe(AuthService.prototype.createGuestToken.name, () => {
    it('should return a signed JWT token for the guest user', async () => {
      const params = { id: 'guest-id-1', name: 'Guest Player' };
      const token = await service.createGuestToken(params);

      expect(token).toBe('mock-token');
    });

    it('should call jwtService.signAsync with correct payload', async () => {
      await service.createGuestToken({ id: 'abc', name: 'Alice' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'abc',
        name: 'Alice',
        isGuest: true,
      });
    });
  });
});
