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
  public create(
    @Request() request: AuthRequest,
    @Body() createPlayerDto: CreatePlayerDto,
  ): Promise<PlayerDto> {
    const user = request.user;
    return this.playerService.create(
      createPlayerDto,
      user,
    ) as unknown as Promise<PlayerDto>;
  }

  @ApiOkResponse({
    description: 'List of players.',
    type: PlayerListDto,
  })
  @Get()
  public findAll(): Promise<PlayerListDto> {
    return this.playerService.findAll() as unknown as Promise<PlayerListDto>;
  }

  @ApiOkResponse({
    description: 'The player with the specified id.',
    type: PlayerDto,
  })
  @Get(':id')
  public findOne(@Param('id') id: string): Promise<PlayerDto> {
    return this.playerService.findOne(id) as unknown as Promise<PlayerDto>;
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
  public remove(@Param('id') id: string): Promise<PlayerDto> {
    return this.playerService.remove(id) as unknown as Promise<PlayerDto>;
  }
}
