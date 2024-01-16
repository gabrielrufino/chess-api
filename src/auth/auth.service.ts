import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  public async createGuestUser() {
    return {
      token: await this.jwtService.signAsync({
        sub: randomUUID(),
        isGuest: true,
      }),
    };
  }
}
