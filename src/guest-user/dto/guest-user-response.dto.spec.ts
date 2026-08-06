import { plainToInstance } from 'class-transformer';
import { GuestUserResponseDto } from './guest-user-response.dto';

describe(GuestUserResponseDto.name, () => {
  it('should expose id and token properties', () => {
    const plain = {
      id: 'guest-123',
      token: 'some-jwt-token',
    };

    const dto = plainToInstance(GuestUserResponseDto, plain);

    expect(dto.id).toBe('guest-123');
    expect(dto.token).toBe('some-jwt-token');
  });

  it('should exclude properties not decorated with @Expose()', () => {
    const plain = {
      id: 'guest-123',
      token: 'some-jwt-token',
      extraProperty: 'should-be-excluded',
    };

    const dto = plainToInstance(GuestUserResponseDto, plain);

    expect(dto.id).toBe('guest-123');
    expect(dto.token).toBe('some-jwt-token');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect((dto as any).extraProperty).toBeUndefined();
  });
});
