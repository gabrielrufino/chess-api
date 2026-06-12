import { Module } from '@nestjs/common';
import { GuestUserService } from './services/guest-user.service';
import { GuestUserController } from './controllers/guest-user.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [GuestUserService],
  controllers: [GuestUserController],
})
export class GuestUserModule {}
