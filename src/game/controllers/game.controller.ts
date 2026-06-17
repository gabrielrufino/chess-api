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
import { plainToInstance } from 'class-transformer';

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
  public async create(
    @Request() request: AuthRequest,
    @Body() createGameDto: CreateGameDto,
  ): Promise<GameDto> {
    const user = request.user;
    const game = await this.gameService.create(createGameDto, user);
    return plainToInstance(GameDto, game.toJSON());
  }

  @ApiOkResponse({
    description: 'List of available game durations.',
    type: [GameDurationDto],
  })
  @Public()
  @Get('durations')
  public getDurations(): GameDurationDto[] {
    return plainToInstance(GameDurationDto, this.gameService.getDurations());
  }

  @ApiOkResponse({
    description: 'List of games.',
    type: GameListDto,
  })
  @Get()
  public async findAll(): Promise<GameListDto> {
    const result = await this.gameService.findAll();
    return plainToInstance(GameListDto, {
      data: result.data.map((game) => game.toJSON()),
      total: result.total,
    });
  }

  @ApiOkResponse({
    description: 'The game with the specified id.',
    type: GameDto,
  })
  @Get(':id')
  public async findOne(@Param('id') id: string): Promise<GameDto | null> {
    const game = await this.gameService.findOne(id);
    return game ? plainToInstance(GameDto, game.toJSON()) : null;
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
  public async getBoard(@Param('id') id: string): Promise<GameBoardDto> {
    const board = await this.gameService.getBoard(id);
    return plainToInstance(GameBoardDto, board);
  }

  @ApiOkResponse({
    description: 'Get list of moves of the game.',
    type: [GameMoveDto],
  })
  @Get(':id/moves')
  public async getMoves(@Param('id') id: string): Promise<GameMoveDto[]> {
    const moves = await this.gameService.getMoves(id);
    return plainToInstance(GameMoveDto, moves);
  }

  @ApiCreatedResponse({
    description: 'Make a move in the game.',
    type: GameDto,
  })
  @Post(':id/moves')
  public async makeMove(
    @Request() request: AuthRequest,
    @Param('id') id: string,
    @Body() createMoveDto: CreateMoveDto,
  ): Promise<GameDto> {
    const user = request.user;
    const game = await this.gameService.makeMove(id, createMoveDto, user);
    return plainToInstance(GameDto, game.toJSON());
  }

  @ApiCreatedResponse({
    description: 'Claim a timeout in the game.',
    type: GameDto,
  })
  @Post(':id/claim-timeout')
  public async claimTimeout(
    @Request() request: AuthRequest,
    @Param('id') id: string,
  ): Promise<GameDto> {
    const user = request.user;
    const game = await this.gameService.claimTimeout(id, user);
    return plainToInstance(GameDto, game.toJSON());
  }
}
