import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateGameDto } from './dto/create-game.dto';
import { GameService } from './game.service';
import { UpdateGameDto } from './dto/update-game.dto';

@ApiTags('Game')
@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  public create(@Body() createGameDto: CreateGameDto) {
    console.log(createGameDto);
    return this.gameService.create(createGameDto);
  }

  @Get()
  public findAll() {
    return this.gameService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gameService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGameDto: UpdateGameDto) {
    return this.gameService.update(+id, updateGameDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gameService.remove(+id);
  }
}
