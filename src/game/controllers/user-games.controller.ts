import { Controller, Get, UseGuards, Request, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Response } from 'express';
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
  public async exportGames(
    @Request() request: AuthRequest,
    @Res() res: Response,
  ): Promise<void> {
    const csvData = await this.gameService.exportUserGamesToCsv(request.user);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="meu_historico_xadrez.csv"',
    );

    res.status(200).send(csvData);
  }
}
