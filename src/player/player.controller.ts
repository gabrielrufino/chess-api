import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';

import { CreatePlayerDto } from './dto/create-player.dto';
import { PlayerService } from './player.service';
import { UpdatePlayerDto } from './dto/update-player.dto';

@ApiTags('Player')
@Controller('players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post()
  public create(@Body() createPlayerDto: CreatePlayerDto) {
    return this.playerService.create(createPlayerDto);
  }

  @Get()
  public findAll() {
    return this.playerService.findAll();
  }

  @Get(':id')
  public findOne(@Param('id', ParseIntPipe) id: number) {
    return this.playerService.findOne(id);
  }

  @Patch(':id')
  public update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePlayerDto: UpdatePlayerDto,
  ) {
    return this.playerService.update(id, updatePlayerDto);
  }

  @Delete(':id')
  public remove(@Param('id', ParseIntPipe) id: number) {
    return this.playerService.remove(id);
  }
}
