import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  public async createGuestToken(params: { id: string; name: string }) {
    return this.jwtService.signAsync({
      sub: params.id,
      name: params.name,
      isGuest: true,
    });
  }
}
