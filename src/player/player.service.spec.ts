import { Test, TestingModule } from '@nestjs/testing';

import { PlayerService } from './player.service';
import { PlayerRepository } from './repositories/player.repository';

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: PlayerRepository, useValue: {} }, PlayerService],
    }).compile();

    service = module.get<PlayerService>(PlayerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
