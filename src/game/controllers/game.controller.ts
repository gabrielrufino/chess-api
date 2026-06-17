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
import {
  ApiBearerAuth,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Public } from 'src/auth/decorators/public.decorator';

import { CreateGameDto } from '../dto/create-game.dto';
import { CreateMoveDto } from '../dto/create-move.dto';
import { GameService } from '../services/game.service';
import { UpdateGameDto } from '../dto/update-game.dto';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { AuthRequest } from 'src/auth/interfaces/auth-user.interface';
import {
  GameDto,
  GameListDto,
  GameDurationDto,
  GameBoardDto,
  GameMoveDto,
} from '../dto/game-response.dto';

@ApiTags('Game')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @ApiCreatedResponse({
    description: 'Game successfully created.',
    type: GameDto,
  })
  @Post()
  public create(
    @Request() request: AuthRequest,
    @Body() createGameDto: CreateGameDto,
  ): Promise<GameDto> {
    const user = request.user;
    return this.gameService.create(
      createGameDto,
      user,
    ) as unknown as Promise<GameDto>;
  }

  @ApiOkResponse({
    description: 'List of available game durations.',
    type: [GameDurationDto],
  })
  @Public()
  @Get('durations')
  public getDurations(): GameDurationDto[] {
    return this.gameService.getDurations();
  }

  @ApiOkResponse({
    description: 'List of games.',
    type: GameListDto,
  })
  @Get()
  public findAll(): Promise<GameListDto> {
    return this.gameService.findAll() as unknown as Promise<GameListDto>;
  }

  @ApiOkResponse({
    description: 'The game with the specified id.',
    type: GameDto,
  })
  @Get(':id')
  public findOne(@Param('id') id: string): Promise<GameDto> {
    return this.gameService.findOne(id) as unknown as Promise<GameDto>;
  }

  @ApiOkResponse({
    description: 'Update a game by id.',
    type: String,
  })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateGameDto: UpdateGameDto,
  ): string {
    return this.gameService.update(id, updateGameDto);
  }

  @ApiOkResponse({
    description: 'Get board state of the game.',
    type: GameBoardDto,
  })
  @Get(':id/board')
  public getBoard(@Param('id') id: string): Promise<GameBoardDto> {
    return this.gameService.getBoard(id);
  }

  @ApiOkResponse({
    description: 'Get list of moves of the game.',
    type: [GameMoveDto],
  })
  @Get(':id/moves')
  public getMoves(@Param('id') id: string): Promise<GameMoveDto[]> {
    return this.gameService.getMoves(id) as unknown as Promise<GameMoveDto[]>;
  }

  @ApiCreatedResponse({
    description: 'Make a move in the game.',
    type: GameDto,
  })
  @Post(':id/moves')
  public makeMove(
    @Request() request: AuthRequest,
    @Param('id') id: string,
    @Body() createMoveDto: CreateMoveDto,
  ): Promise<GameDto> {
    const user = request.user;
    return this.gameService.makeMove(
      id,
      createMoveDto,
      user,
    ) as unknown as Promise<GameDto>;
  }

  @ApiCreatedResponse({
    description: 'Claim a timeout in the game.',
    type: GameDto,
  })
  @Post(':id/claim-timeout')
  public claimTimeout(
    @Request() request: AuthRequest,
    @Param('id') id: string,
  ): Promise<GameDto> {
    const user = request.user;
    return this.gameService.claimTimeout(
      id,
      user,
    ) as unknown as Promise<GameDto>;
  }
}
