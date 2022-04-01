import { Injectable } from '@nestjs/common';

import { CreateGameDto } from './dto/create-game.dto';
import { GameRepository } from './repositories/game.repository';
import { UpdateGameDto } from './dto/update-game.dto';

@Injectable()
export class GameService {
  constructor(private readonly gameRepository: GameRepository) {}

  public async create(createGameDto: CreateGameDto) {
    const game = this.gameRepository.create(createGameDto);
    await this.gameRepository.save(game);

    return game;
  }

  public async findAll() {
    const [data, total] = await this.gameRepository.findAndCount();

    return {
      data,
      total,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} game`;
  }

  update(id: number, updateGameDto: UpdateGameDto) {
    return `This action updates a #${id} game`;
  }

  remove(id: number) {
    return `This action removes a #${id} game`;
  }
}
