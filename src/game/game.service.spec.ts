import { Test, TestingModule } from '@nestjs/testing';

import { GameService } from './game.service';
import { GameRepository } from './repositories/game.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlayerEntity } from 'src/player/entities/player.entity';

describe('GameService', () => {
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: GameRepository, useValue: {} },
        {
          provide: getRepositoryToken(PlayerEntity),
          useValue: {},
        },
        GameService,
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
