import { Injectable } from '@nestjs/common';
import { CreateGuestUserDto } from './dto/create-guest-user.dto';
import { AuthService } from 'src/auth/auth.service';
import { randomUUID } from 'crypto';

@Injectable()
export class GuestUserService {
  constructor(private readonly authService: AuthService) {}

  public async createGuestUser(createGuestUserDto: CreateGuestUserDto) {
    const id = randomUUID();

    return {
      id,
      name: createGuestUserDto.name,
      token: await this.authService.createGuestToken({
        id,
        name: createGuestUserDto.name,
      }),
    };
  }
}
