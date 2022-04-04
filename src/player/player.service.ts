import { Injectable } from '@nestjs/common';

import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayerRepository } from './repositories/player.repository';

@Injectable()
export class PlayerService {
  constructor(private readonly playerRepository: PlayerRepository) {}

  public async create(createPlayerDto: CreatePlayerDto) {
    const player = this.playerRepository.create(createPlayerDto);
    await this.playerRepository.save(player);

    return player;
  }

  public async findAll() {
    const [players, total] = await this.playerRepository.findAndCount();

    return {
      data: players,
      total,
    };
  }

  public async findOne(id: number) {
    return this.playerRepository.findOne(id);
  }

  public async update(id: number, updatePlayerDto: UpdatePlayerDto) {
    return `This action updates a #${id} player`;
  }

  public async remove(id: number) {
    return `This action removes a #${id} player`;
  }
}
