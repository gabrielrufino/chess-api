import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Player, PlayerDocument } from '../schemas/player.schema';
import { AuthUser } from 'src/auth/interfaces/auth-user.interface';
import { CreatePlayerDto } from '../dto/create-player.dto';
import { UpdatePlayerDto } from '../dto/update-player.dto';
import { FindAllPlayersDto } from '../dto/find-all-players.dto';
import { WithId } from 'mongodb';
import { NicknameAlreadyTakenException } from '../exceptions/nickname-already-taken.exception';
import { escapeRegExp } from '../../common/utils/escape-regexp.util';
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
  NumberDictionary,
} from 'unique-names-generator';

@Injectable()
export class PlayerService {
  private static readonly NICKNAME_RESERVATION_TTL_MS = 5 * 60 * 1000; // 5 minutes
  constructor(
    @InjectModel(Player.name)
    private readonly playerModel: Model<PlayerDocument>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  public async create(authUser: AuthUser, createPlayerDto: CreatePlayerDto) {
    const existing = await this.playerModel.findOne({
      nickname: createPlayerDto.nickname,
      deletedAt: null,
    });

    if (existing) {
      throw new NicknameAlreadyTakenException(createPlayerDto.nickname);
    }

    try {
      const player = await this.playerModel.create({
        userId: authUser.sub,
        isGuest: authUser.isGuest,
        nickname: createPlayerDto.nickname,
      });

      await this.cacheManager.del(
        this.nicknameReserveKey(createPlayerDto.nickname),
      );

      return player;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new NicknameAlreadyTakenException(createPlayerDto.nickname);
      }
      throw error;
    }
  }

  public async findAll(query?: FindAllPlayersDto) {
    const filter: Record<string, unknown> = { deletedAt: null };

    if (query?.nickname) {
      filter.nickname = { $regex: escapeRegExp(query.nickname), $options: 'i' };
    }

    const [total, players] = await Promise.all([
      this.playerModel.countDocuments(filter),
      this.playerModel.find(filter).lean(),
    ]);

    return {
      data: players,
      total,
    };
  }

  public async findOne(id: string): Promise<WithId<Player> | null> {
    return this.playerModel.findById(id).lean<WithId<Player>>();
  }

  /**
   * Atomically soft-deletes a player only if it belongs to the given userId.
   * Returns null if the player does not exist or does not belong to the user.
   */
  public async removeIfOwner(
    id: string,
    userId: string,
  ): Promise<PlayerDocument | null> {
    return this.playerModel.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { deletedAt: new Date() },
      { new: true },
    );
  }

  /**
   * Atomically updates a player's fields only if it belongs to the given userId.
   * Returns null if the player does not exist, is deleted, or does not belong to the user.
   * Throws NicknameAlreadyTakenException on duplicate nickname.
   */
  public async updateIfOwner(
    id: string,
    userId: string,
    updatePlayerDto: UpdatePlayerDto,
  ): Promise<PlayerDocument | null> {
    try {
      const player = await this.playerModel.findOneAndUpdate(
        { _id: id, userId, deletedAt: null },
        { $set: updatePlayerDto },
        { new: true, runValidators: true },
      );

      if (player && updatePlayerDto.nickname) {
        await this.cacheManager.del(
          this.nicknameReserveKey(updatePlayerDto.nickname),
        );
      }

      return player;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new NicknameAlreadyTakenException(updatePlayerDto.nickname ?? '');
      }
      throw error;
    }
  }

  public async suggestNickname(authUser: AuthUser): Promise<string> {
    const maxAttempts = 10;
    const numberDictionary = NumberDictionary.generate({
      min: 1000,
      max: 9999,
    });

    for (let i = 0; i < maxAttempts; i++) {
      const candidate = uniqueNamesGenerator({
        dictionaries: [adjectives, animals, numberDictionary],
        separator: '',
        style: 'capital',
      });

      const isReserved = await this.cacheManager.get(
        this.nicknameReserveKey(candidate),
      );
      if (isReserved) continue;

      const exists = await this.playerModel.findOne({
        nickname: candidate,
        deletedAt: null,
      });

      if (!exists) {
        await this.cacheManager.set(
          this.nicknameReserveKey(candidate),
          authUser.sub,
          PlayerService.NICKNAME_RESERVATION_TTL_MS,
        );
        return candidate;
      }
    }

    // Fallback with timestamp to guarantee uniqueness
    const fallback = `Guest${Date.now()}`;
    await this.cacheManager.set(
      this.nicknameReserveKey(fallback),
      authUser.sub,
      PlayerService.NICKNAME_RESERVATION_TTL_MS,
    );
    return fallback;
  }

  /**
   * Dismisses a nickname reservation from the cache.
   * If the reservation belongs to a different user, the request is silently
   * ignored (privacy by design — callers cannot discover whether a nickname
   * is reserved or by whom).
   */
  public async dismissNicknameReservation(
    nickname: string,
    userId: string,
  ): Promise<void> {
    const owner = await this.cacheManager.get<string>(
      this.nicknameReserveKey(nickname),
    );
    // Only the user who reserved the nickname can dismiss it
    if (owner !== null && owner !== userId) return;
    await this.cacheManager.del(this.nicknameReserveKey(nickname));
  }

  private nicknameReserveKey(nickname: string): string {
    return `nickname-reserve:${nickname}`;
  }
}
