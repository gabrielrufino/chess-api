import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/auth/decorators/public.decorator';

import { CreateGameDto } from '../dto/create-game.dto';
import { CreateMoveDto } from '../dto/create-move.dto';
import { GameService } from '../services/game.service';
import { UpdateGameDto } from '../dto/update-game.dto';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { AuthRequest } from 'src/auth/interfaces/auth-user.interface';

@ApiTags('Game')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  public create(
    @Request() request: AuthRequest,
    @Body() createGameDto: CreateGameDto,
  ) {
    const user = request.user;
    return this.gameService.create(createGameDto, user);
  }

  @Public()
  @Get('durations')
  public getDurations() {
    return this.gameService.getDurations();
  }

  @Get()
  public findAll() {
    return this.gameService.findAll();
  }

  @Get(':id')
  public findOne(@Param('id') id: string) {
    return this.gameService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGameDto: UpdateGameDto) {
    return this.gameService.update(id, updateGameDto);
  }

  @Get(':id/board')
  public getBoard(@Param('id') id: string) {
    return this.gameService.getBoard(id);
  }

  @Get(':id/moves')
  public getMoves(@Param('id') id: string) {
    return this.gameService.getMoves(id);
  }

  @Post(':id/moves')
  public makeMove(
    @Request() request: AuthRequest,
    @Param('id') id: string,
    @Body() createMoveDto: CreateMoveDto,
  ) {
    const user = request.user;
    return this.gameService.makeMove(id, createMoveDto, user);
  }

  @Post(':id/claim-timeout')
  public claimTimeout(
    @Request() request: AuthRequest,
    @Param('id') id: string,
  ) {
    const user = request.user;
    return this.gameService.claimTimeout(id, user);
  }
}
