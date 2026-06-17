import { Body, Controller, Post } from '@nestjs/common';
import { GuestUserService } from '../services/guest-user.service';
import { ApiTags, ApiCreatedResponse } from '@nestjs/swagger';
import { CreateGuestUserDto } from '../dto/create-guest-user.dto';
import { GuestUserDto } from '../dto/guest-user-response.dto';
import { plainToInstance } from 'class-transformer';

@ApiTags('Guest users')
@Controller('guest-users')
export class GuestUserController {
  constructor(private readonly guestUserService: GuestUserService) {}

  @ApiCreatedResponse({
    description: 'Guest user successfully created.',
    type: GuestUserDto,
  })
  @Post()
  public async createGuestUser(
    @Body() createGuestUserDto: CreateGuestUserDto,
  ): Promise<GuestUserDto> {
    const guestUser =
      await this.guestUserService.createGuestUser(createGuestUserDto);
    return plainToInstance(GuestUserDto, guestUser);
  }
}
