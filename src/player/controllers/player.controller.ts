import {
  ApiBearerAuth,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
  ApiConflictResponse,
  ApiForbiddenResponse,
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
  ForbiddenException,
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
    type: PlayerDto,
  })
  @ApiConflictResponse({
    description: 'Nickname is already taken.',
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this player.',
  })
  @Patch(':id')
  public async update(
    @Request() request: AuthRequest,
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updatePlayerDto: UpdatePlayerDto,
  ): Promise<PlayerDto> {
    const player = await this.playerService.findOne(id);
    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }
    if (player.userId !== request.user.sub) {
      throw new ForbiddenException('You are not allowed to update this player');
    }
    // Defensive check: handles the rare race condition where the player
    // was deleted between the findOne ownership check and this operation.
    const updatedPlayer = await this.playerService.updateIfOwner(
      id,
      request.user.sub,
      updatePlayerDto,
    );
    if (!updatedPlayer) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }
    return plainToInstance(PlayerDto, updatedPlayer.toJSON());
  }

  @ApiOkResponse({
    description: 'Delete a player by id.',
    type: PlayerDto,
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this player.',
  })
  @Delete(':id')
  public async remove(
    @Request() request: AuthRequest,
    @Param('id', ParseMongoIdPipe) id: string,
  ): Promise<PlayerDto> {
    const player = await this.playerService.findOne(id);
    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }
    if (player.userId !== request.user.sub) {
      throw new ForbiddenException('You are not allowed to delete this player');
    }
    // Defensive check: handles the rare race condition where the player
    // was deleted between the findOne ownership check and this operation.
    const removedPlayer = await this.playerService.removeIfOwner(
      id,
      request.user.sub,
    );
    if (!removedPlayer) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }
    return plainToInstance(PlayerDto, removedPlayer.toJSON());
  }
}
