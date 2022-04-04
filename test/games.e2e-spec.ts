import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Game } from '../src/game/entities/game.entity';
import { GameModule } from '../src/game/game.module';

describe('GameModule (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          entities: [Game],
          synchronize: true,
          logging: false,
        }),
        GameModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    await app.init();
  });

  describe('POST /games', () => {
    it('Should create a new game when receive correct data', () => {
      return request(app.getHttpServer())
        .post('/games')
        .send({
          startsAt: '2022-04-03 17:00:00',
          endsAt: '2022-04-03 17:15:00',
        })
        .expect(201);
    });

    it('Should return an error when does not receive the startsAt', () => {
      return request(app.getHttpServer())
        .post('/games')
        .send({
          endsAt: '2022-04-03 17:15:00',
        })
        .expect(400)
        .expect({
          statusCode: 400,
          message: [
            'startsAt should not be null or undefined',
            'startsAt must be a valid ISO 8601 date string',
          ],
          error: 'Bad Request',
        });
    });

    it('Should return an error when does not receive the endsAt', () => {
      return request(app.getHttpServer())
        .post('/games')
        .send({
          startsAt: '2022-04-03 17:00:00',
        })
        .expect(400)
        .expect({
          statusCode: 400,
          message: [
            'endsAt should not be null or undefined',
            'endsAt must be a valid ISO 8601 date string',
          ],
          error: 'Bad Request',
        });
    });
  });

  describe('GET /games', () => {
    it('Should list all the games', () => {
      return request(app.getHttpServer())
        .get('/games')
        .expect(200)
        .expect({ data: [], total: 0 });
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
