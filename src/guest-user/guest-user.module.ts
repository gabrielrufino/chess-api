import { Module } from '@nestjs/common';
import { GuestUserService } from './guest-user.service';
import { GuestUserController } from './guest-user.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [GuestUserService],
  controllers: [GuestUserController],
})
export class GuestUserModule {}
