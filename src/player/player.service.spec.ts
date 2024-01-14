import { Test, TestingModule } from '@nestjs/testing';

import { PlayerService } from './player.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlayerEntity } from './entities/player.entity';

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(PlayerEntity),
          useValue: {},
        },
        PlayerService,
      ],
    }).compile();

    service = module.get<PlayerService>(PlayerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
