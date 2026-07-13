import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/services/auth.service';
import { randomUUID } from 'crypto';

@Injectable()
export class GuestUserService {
  constructor(private readonly authService: AuthService) {}

  public async createGuestUser() {
    const id = randomUUID();

    return {
      id,
      token: await this.authService.createGuestToken({ id }),
    };
  }
}
