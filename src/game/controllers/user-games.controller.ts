import {
  Controller,
  Get,
  UseGuards,
  Request,
  Header,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { AuthRequest } from 'src/auth/interfaces/auth-user.interface';
import { GameService } from '../services/game.service';

@ApiTags('User Games')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users/me/games')
export class UserGamesController {
  constructor(private readonly gameService: GameService) {}

  @ApiOkResponse({
    description: 'Export of user games in CSV format.',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="meu_historico_xadrez.csv"',
  )
  public async exportGames(
    @Request() request: AuthRequest,
  ): Promise<StreamableFile> {
    const csvData = await this.gameService.exportUserGamesToCsv(request.user);

    return new StreamableFile(Buffer.from(csvData));
  }
}
