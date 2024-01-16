import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import faker from '@faker-js/faker';
import * as request from 'supertest';

import { GameEntity } from '../src/game/entities/game.entity';
import { GameModule } from '../src/game/game.module';
import { PlayerEntity } from '../src/player/entities/player.entity';
import { PlayerModule } from '../src/player/player.module';
import { CreateGameDto } from 'src/game/dto/create-game.dto';
import { createPlayer } from './helpers/create-player';

describe('GameModule (e2e)', () => {
  let app: INestApplication;
  let client: request.SuperTest<request.Request>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          entities: [GameEntity, PlayerEntity],
          synchronize: true,
          logging: false,
        }),
        GameModule,
        PlayerModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    await app.init();

    client = request(app.getHttpServer());
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /games', () => {
    it('Should create a new game when receive correct data', async () => {
      const [{ id: whitePlayerId }, { id: blackPlayerId }] = await Promise.all([
        createPlayer(app),
        createPlayer(app),
      ]);

      const response = await client.post('/games').send({
        startsAt: '2022-04-03 17:00:00',
        endsAt: '2022-04-03 17:15:00',
        whitePlayerId,
        blackPlayerId,
      } as CreateGameDto);

      expect(response.status).toBe(HttpStatus.CREATED);
    });

    it('Should return an error when does not receive the startsAt', async () => {
      const [{ id: whitePlayerId }, { id: blackPlayerId }] = await Promise.all([
        createPlayer(app),
        createPlayer(app),
      ]);

      return request(app.getHttpServer())
        .post('/games')
        .send({
          endsAt: '2022-04-03 17:15:00',
          whitePlayerId,
          blackPlayerId,
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

    it('Should return an error when does not receive the endsAt', async () => {
      const [{ id: whitePlayerId }, { id: blackPlayerId }] = await Promise.all([
        createPlayer(app),
        createPlayer(app),
      ]);

      return request(app.getHttpServer())
        .post('/games')
        .send({
          startsAt: '2022-04-03 17:00:00',
          whitePlayerId,
          blackPlayerId,
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

    it('Should return an not found error when the black player does not exists', async () => {
      const { id: whitePlayerId } = await createPlayer(app);
      const blackPlayerId = faker.datatype.number();

      return request(app.getHttpServer())
        .post('/games')
        .send({
          startsAt: '2022-04-03 17:00:00',
          endsAt: '2022-04-03 17:15:00',
          whitePlayerId,
          blackPlayerId,
        } as CreateGameDto)
        .expect(HttpStatus.NOT_FOUND)
        .expect({
          statusCode: 404,
          message: 'Player not found',
        });
    });

    it('Should return an not found error when the white player does not exists', async () => {
      const whitePlayerId = faker.datatype.number();
      const { id: blackPlayerId } = await createPlayer(app);

      return request(app.getHttpServer())
        .post('/games')
        .send({
          startsAt: '2022-04-03 17:00:00',
          endsAt: '2022-04-03 17:15:00',
          whitePlayerId,
          blackPlayerId,
        } as CreateGameDto)
        .expect(HttpStatus.NOT_FOUND)
        .expect({
          statusCode: 404,
          message: 'Player not found',
        });
    });

    it("Should return an not found error when both players don't exists", async () => {
      const whitePlayerId = faker.datatype.number();
      const blackPlayerId = faker.datatype.number();

      return request(app.getHttpServer())
        .post('/games')
        .send({
          startsAt: '2022-04-03 17:00:00',
          endsAt: '2022-04-03 17:15:00',
          whitePlayerId,
          blackPlayerId,
        } as CreateGameDto)
        .expect(HttpStatus.NOT_FOUND)
        .expect({
          statusCode: 404,
          message: 'Player not found',
        });
    });

    it('Should return an error when the white player and the black player are the same player', async () => {
      const { id: whitePlayerId } = await createPlayer(app);
      const blackPlayerId = whitePlayerId;

      return request(app.getHttpServer())
        .post('/games')
        .send({
          startsAt: '2022-04-03 17:00:00',
          endsAt: '2022-04-03 17:15:00',
          whitePlayerId,
          blackPlayerId,
        } as CreateGameDto)
        .expect(HttpStatus.PRECONDITION_FAILED)
        .expect({
          statusCode: 412,
          message: "You can't play against yourself",
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
});
