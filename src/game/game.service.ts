import { Injectable } from '@nestjs/common';

import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { IsNull, Repository } from 'typeorm';
import { PlayerEntity } from 'src/player/entities/player.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { GameEntity } from './entities/game.entity';
import { AuthUser } from 'src/auth/auth-user.interface';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(GameEntity)
    private readonly gameRepository: Repository<GameEntity>,
    @InjectRepository(PlayerEntity)
    private readonly playerRepository: Repository<PlayerEntity>,
  ) {}

  public async create(createGameDto: CreateGameDto, authUser: AuthUser) {
    const player = await this.playerRepository.findOneByOrFail({
      userId: authUser.sub,
    });

    const gameWaitingPlayer = await this.gameRepository
      .createQueryBuilder('game')
      .where([{ whitePlayerId: IsNull() }, { blackPlayerId: IsNull() }])
      .andWhere(
        "COALESCE(game.whitePlayerId, '') != :playerId AND COALESCE(game.blackPlayerId, '') != :playerId",
        { playerId: player.id },
      )
      .andWhere({ duration: createGameDto.duration })
      .getOne();

    if (gameWaitingPlayer) {
      await this.gameRepository.save({
        ...gameWaitingPlayer,
        whitePlayerId: gameWaitingPlayer.whitePlayerId || player.id,
        blackPlayerId: gameWaitingPlayer.blackPlayerId || player.id,
      });

      return gameWaitingPlayer;
    }

    const newGame = this.gameRepository.create({
      ...createGameDto,
      whitePlayerId: player.id,
    });

    await this.gameRepository.save(newGame);

    return newGame;
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

  public async findOne(id: string) {
    return this.gameRepository.findOne({
      where: { id },
      relations: ['whitePlayer', 'blackPlayer'],
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(id: number, updateGameDto: UpdateGameDto) {
    return `This action updates a #${id} game`;
  }
}
