import { Controller, Post } from '@nestjs/common';
import { GuestUserService } from '../services/guest-user.service';
import { ApiTags, ApiCreatedResponse } from '@nestjs/swagger';
import { GuestUserResponseDto } from '../dto/guest-user-response.dto';
import { plainToInstance } from 'class-transformer';

@ApiTags('Guest users')
@Controller('guest-users')
export class GuestUserController {
  constructor(private readonly guestUserService: GuestUserService) {}

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
