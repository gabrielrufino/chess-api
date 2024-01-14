import { Injectable } from '@nestjs/common';

import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { Repository } from 'typeorm';
import { PlayerEntity } from './entities/player.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(PlayerEntity)
    private readonly playerRepository: Repository<PlayerEntity>,
  ) {}

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
    return this.playerRepository.findOneBy({ id });
  }

  public async update(id: number, updatePlayerDto: UpdatePlayerDto) {
    return `This action updates a #${id} player`;
  }

  public async remove(id: number) {
    return this.playerRepository.softDelete(id);
  }
}
