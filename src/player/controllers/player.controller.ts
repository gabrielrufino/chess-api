import {
  ApiBearerAuth,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
  ApiConflictResponse,
} from '@nestjs/swagger';
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
  NotFoundException,
  Query,
} from '@nestjs/common';

import { PlayerService } from '../services/player.service';
import { CreatePlayerDto } from '../dto/create-player.dto';
import { UpdatePlayerDto } from '../dto/update-player.dto';
import { FindAllPlayersDto } from '../dto/find-all-players.dto';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';
import { AuthRequest } from 'src/auth/interfaces/auth-user.interface';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import {
  NicknameSuggestionDto,
  PlayerDto,
  PlayerListDto,
} from '../dto/player-response.dto';
import { plainToInstance } from 'class-transformer';

@ApiTags('Player')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @ApiCreatedResponse({
    description: 'Player successfully created.',
    type: PlayerDto,
  })
  @ApiConflictResponse({
    description: 'Nickname is already taken.',
  })
  @Post()
  public async create(
    @Request() request: AuthRequest,
    @Body() createPlayerDto: CreatePlayerDto,
  ): Promise<PlayerDto> {
    const user = request.user;
    const player = await this.playerService.create(user, createPlayerDto);
    return plainToInstance(PlayerDto, player.toJSON());
  }

  @ApiOkResponse({
    description: 'List of players.',
    type: PlayerListDto,
  })
  @ApiQuery({
    name: 'nickname',
    required: false,
    description: 'Filter players by nickname (partial, case-insensitive)',
  })
  @Get()
  public async findAll(
    @Query() query: FindAllPlayersDto,
  ): Promise<PlayerListDto> {
    const result = await this.playerService.findAll(query);
    return plainToInstance(PlayerListDto, {
      data: result.data,
      total: result.total,
    });
  }

  @ApiOkResponse({
    description: 'A suggested available nickname.',
    type: NicknameSuggestionDto,
  })
  @Get('nickname-suggestion')
  public async suggestNickname(): Promise<NicknameSuggestionDto> {
    const nickname = await this.playerService.suggestNickname();
    return plainToInstance(NicknameSuggestionDto, { nickname });
  }

  @ApiOkResponse({
    description: 'The player with the specified id.',
    type: PlayerDto,
  })
  @Get(':id')
  public async findOne(
    @Param('id', ParseMongoIdPipe) id: string,
  ): Promise<PlayerDto> {
    const player = await this.playerService.findOne(id);
    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }
    return plainToInstance(PlayerDto, player);
  }

  @ApiOkResponse({
    description: 'Update a player by id.',
    type: String,
  })
  @Patch(':id')
  public update(
    @Param('id', ParseMongoIdPipe) id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() updatePlayerDto: UpdatePlayerDto,
  ): string {
    return this.playerService.update(id);
  }

  @ApiOkResponse({
    description: 'Delete a player by id.',
    type: PlayerDto,
  })
  @Delete(':id')
  public async remove(
    @Param('id', ParseMongoIdPipe) id: string,
  ): Promise<PlayerDto> {
    const player = await this.playerService.remove(id);
    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }
    return plainToInstance(PlayerDto, player.toJSON());
  }
}
