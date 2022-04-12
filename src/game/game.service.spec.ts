import { Test, TestingModule } from '@nestjs/testing';
import { PlayerRepository } from 'src/player/repositories/player.repository';

import { GameService } from './game.service';
import { GameRepository } from './repositories/game.repository';

describe('GameService', () => {
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: GameRepository, useValue: {} },
        { provide: PlayerRepository, useValue: {} },
        GameService,
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
