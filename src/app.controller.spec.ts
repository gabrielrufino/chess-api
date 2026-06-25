import { HealthCheckService } from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue({ status: 'ok', details: {} }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('Should be defined', () => {
    expect(appController).toBeDefined();
  });

  describe('Health check', () => {
    it('should return health check result', async () => {
      const result = await appController.check();
      expect(result).toEqual({ status: 'ok', details: {} });
    });
  });
});
