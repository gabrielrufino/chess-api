import { Injectable } from '@nestjs/common';

import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { Repository } from 'typeorm';
import { PlayerEntity } from './entities/player.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthUser } from 'src/auth/auth-user.interface';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(PlayerEntity)
    private readonly playerRepository: Repository<PlayerEntity>,
  ) {}

  public async create(createPlayerDto: CreatePlayerDto, authUser: AuthUser) {
    const player = this.playerRepository.create({
      ...createPlayerDto,
      userId: authUser.sub,
      isGuest: authUser.isGuest,
    });

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

  public async findOne(id: string) {
    return this.playerRepository.findOneBy({ id });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async update(id: string, updatePlayerDto: UpdatePlayerDto) {
    return `This action updates a #${id} player`;
  }

  public async remove(id: string) {
    return this.playerRepository.softDelete(id);
  }
}
