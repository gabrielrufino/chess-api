import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'jwt-secret',
    }),
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
