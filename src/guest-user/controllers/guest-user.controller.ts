import { Body, Controller, Post } from '@nestjs/common';
import { GuestUserService } from '../services/guest-user.service';
import { ApiTags } from '@nestjs/swagger';
import { CreateGuestUserDto } from '../dto/create-guest-user.dto';

@ApiTags('Guest users')
@Controller('guest-users')
export class GuestUserController {
  constructor(private readonly guestUserService: GuestUserService) {}

  @Post()
  public createGuestUser(@Body() createGuestUserDto: CreateGuestUserDto) {
    return this.guestUserService.createGuestUser(createGuestUserDto);
  }
}
