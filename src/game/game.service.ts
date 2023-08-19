import { Injectable } from '@nestjs/common';
import { PlayerRepository } from 'src/player/repositories/player.repository';

import { CreateGameDto } from './dto/create-game.dto';
import { GameRepository } from './repositories/game.repository';
import { UpdateGameDto } from './dto/update-game.dto';
import { PlayerNotFoundException } from 'src/player/exceptions/player-not-found.exception';
import { GameAgainstYourselfException } from './exceptions/game-against-yourself.exception';

@Injectable()
export class GameService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly playerRepository: PlayerRepository,
  ) {}

  public async create(createGameDto: CreateGameDto) {
    const { whitePlayerId, blackPlayerId } = createGameDto;

    const [whitePlayer, blackPlayer] = await Promise.all([
      this.playerRepository.findOneBy({ id: whitePlayerId }),
      this.playerRepository.findOneBy({ id: blackPlayerId }),
    ]);

    if (!whitePlayer || !blackPlayer) {
      throw new PlayerNotFoundException();
    }

    if (whitePlayerId === blackPlayerId) {
      throw new GameAgainstYourselfException();
    }

    const game = this.gameRepository.create(createGameDto);
    await this.gameRepository.save(game);

    return game;
  }

  public async findAll() {
    const [data, total] = await this.gameRepository.findAndCount({
      relations: ['whitePlayer', 'blackPlayer'],
    });

    return {
      data,
      total,
    };
  }

  public async findOne(id: number) {
    return this.gameRepository.findOne({
      where: { id },
      relations: ['whitePlayer', 'blackPlayer'],
    });
  }

  update(id: number, updateGameDto: UpdateGameDto) {
    return `This action updates a #${id} game`;
  }
}
