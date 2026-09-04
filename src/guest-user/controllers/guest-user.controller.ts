import { Controller, Post } from '@nestjs/common';
import { GuestUserService } from '../services/guest-user.service';
import { ApiTags, ApiCreatedResponse } from '@nestjs/swagger';
import { GuestUserResponseDto } from '../dto/guest-user-response.dto';
import { plainToInstance } from 'class-transformer';
import { Public } from 'src/auth/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Guest users')
@Controller('guest-users')
export class GuestUserController {
  constructor(private readonly guestUserService: GuestUserService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiCreatedResponse({
    description: 'Guest user successfully created.',
    type: GuestUserResponseDto,
  })
  @Post()
  public async createGuestUser(): Promise<GuestUserResponseDto> {
    const guestUser = await this.guestUserService.createGuestUser();
    return plainToInstance(GuestUserResponseDto, guestUser);
  }
}
