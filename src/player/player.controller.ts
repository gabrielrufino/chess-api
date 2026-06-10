import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  UseGuards,
} from '@nestjs/common';

import { CreatePlayerDto } from './dto/create-player.dto';
import { PlayerService } from './player.service';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { AuthRequest } from 'src/auth/auth-user.interface';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiTags('Player')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post()
  public create(
    @Request() request: AuthRequest,
    @Body() createPlayerDto: CreatePlayerDto,
  ) {
    const user = request.user;
    return this.playerService.create(createPlayerDto, user);
  }

  @Get()
  public findAll() {
    return this.playerService.findAll();
  }

  @Get(':id')
  public findOne(@Param('id') id: string) {
    return this.playerService.findOne(id);
  }

  @Patch(':id')
  public update(
    @Param('id') id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() updatePlayerDto: UpdatePlayerDto,
  ) {
    return this.playerService.update(id);
  }

  @Delete(':id')
  public remove(@Param('id') id: string) {
    return this.playerService.remove(id);
  }
}
