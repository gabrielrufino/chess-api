import {
  ApiBearerAuth,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
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
} from '@nestjs/common';

import { CreatePlayerDto } from '../dto/create-player.dto';
import { PlayerService } from '../services/player.service';
import { UpdatePlayerDto } from '../dto/update-player.dto';
import { AuthRequest } from 'src/auth/interfaces/auth-user.interface';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { PlayerDto, PlayerListDto } from '../dto/player-response.dto';
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
  @Post()
  public async create(
    @Request() request: AuthRequest,
    @Body() createPlayerDto: CreatePlayerDto,
  ): Promise<PlayerDto> {
    const user = request.user;
    const player = await this.playerService.create(createPlayerDto, user);
    return plainToInstance(PlayerDto, player.toJSON());
  }

  @ApiOkResponse({
    description: 'List of players.',
    type: PlayerListDto,
  })
  @Get()
  public async findAll(): Promise<PlayerListDto> {
    const result = await this.playerService.findAll();
    return plainToInstance(PlayerListDto, {
      data: result.data.map((player) => player.toJSON()),
      total: result.total,
    });
  }

  @ApiOkResponse({
    description: 'The player with the specified id.',
    type: PlayerDto,
  })
  @Get(':id')
  public async findOne(@Param('id') id: string): Promise<PlayerDto> {
    const player = await this.playerService.findOne(id);
    return player ? plainToInstance(PlayerDto, player.toJSON()) : null;
  }

  @ApiOkResponse({
    description: 'Update a player by id.',
    type: String,
  })
  @Patch(':id')
  public update(
    @Param('id') id: string,
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
  public async remove(@Param('id') id: string): Promise<PlayerDto> {
    const player = await this.playerService.remove(id);
    return player ? plainToInstance(PlayerDto, player.toJSON()) : null;
  }
}
