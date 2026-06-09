import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import faker from '@faker-js/faker';
import * as request from 'supertest';

import { AuthModule } from '../src/auth/auth.module';
import { AuthGuard } from '../src/auth/auth.guard';
import { GameModule } from '../src/game/game.module';
import { PlayerModule } from '../src/player/player.module';
import { CreateGameDto } from 'src/game/dto/create-game.dto';
import { createPlayer } from './helpers/create-player';
import { GameDurationEnum } from 'src/game/enumerables/game-duration.enum';

describe('GameModule (e2e)', () => {
  let app: INestApplication;
  let client: any;

  let mongod: MongoMemoryServer;

  beforeEach(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        AuthModule,
        GameModule,
        PlayerModule,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          const userId = req.headers['x-user-id'] || faker.datatype.uuid();
          req.user = { sub: userId, isGuest: true, username: 'test' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    await app.init();

    client = request(app.getHttpServer());
  });

  afterEach(async () => {
    if (app) await app.close();
    if (mongod) {
      await mongod.stop();
    }
  });

  describe('POST /games', () => {
    it('Should create a new game when receive correct data', async () => {
      const { authUserId } = await createPlayer(app);

      const response = await client.post('/games')
        .set('x-user-id', authUserId)
        .send({
          duration: GameDurationEnum.OneMinute
        } as CreateGameDto);

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body.whitePlayerId).toBeDefined();
      expect(response.body.blackPlayerId).toBeUndefined(); // or null based on schema, but not set yet
    });

    it('Should return a validation error when does not receive duration', async () => {
      const { authUserId } = await createPlayer(app);

      return request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', authUserId)
        .send({})
        .expect(400);
    });

    it('Should return an error when the player does not exist', async () => {
      return request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', faker.datatype.uuid()) // invalid user
        .send({
          duration: GameDurationEnum.FiveMinutes
        } as CreateGameDto)
        .expect(HttpStatus.NOT_FOUND)
        .expect({
          message: 'Player not found',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('Should join an existing waiting game', async () => {
      const { authUserId: player1Id } = await createPlayer(app);
      const { authUserId: player2Id } = await createPlayer(app);

      // Player 1 creates game
      const res1 = await request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', player1Id)
        .send({ duration: GameDurationEnum.FiveMinutes });
      
      expect(res1.status).toBe(HttpStatus.CREATED);

      // Player 2 joins game
      const res2 = await request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', player2Id)
        .send({ duration: GameDurationEnum.FiveMinutes });
      
      expect(res2.status).toBe(HttpStatus.CREATED);
      
      // Should be the same game ID
      expect(res2.body._id).toBe(res1.body._id);
      expect(res2.body.whitePlayerId).toBeDefined();
      expect(res2.body.blackPlayerId).toBeDefined();
    });
  });

  describe('GET /games', () => {
    it('Should list all the games', () => {
      return request(app.getHttpServer())
        .get('/games')
        .set('x-user-id', faker.datatype.uuid())
        .expect(200)
        .expect({ data: [], total: 0 });
    });
  });

  describe('Play Game', () => {
    it('Should play a full game of chess until checkmate', async () => {
      const { authUserId: player1Id } = await createPlayer(app);
      const { authUserId: player2Id } = await createPlayer(app);

      // Player 1 creates game
      const res1 = await request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', player1Id)
        .send({ duration: GameDurationEnum.FiveMinutes });
      const gameId = res1.body._id;

      // Player 2 joins game
      await request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', player2Id)
        .send({ duration: GameDurationEnum.FiveMinutes });

      // Get board
      const boardRes = await request(app.getHttpServer())
        .get(`/games/${gameId}/board`)
        .set('x-user-id', player1Id)
        .expect(200);
      expect(boardRes.body.fen).toBeDefined();
      expect(boardRes.body.board).toBeDefined();

      // Scholar's Mate Sequence
      const moves = [
        { player: player1Id, move: 'e4' },
        { player: player2Id, move: 'e5' },
        { player: player1Id, move: 'Bc4' },
        { player: player2Id, move: 'Nc6' },
        { player: player1Id, move: 'Qh5' },
        { player: player2Id, move: 'Nf6' },
        { player: player1Id, move: 'Qxf7#' },
      ];

      for (const m of moves) {
        // List moves before
        const movesRes = await request(app.getHttpServer())
          .get(`/games/${gameId}/moves`)
          .set('x-user-id', m.player)
          .expect(200);
        expect(Array.isArray(movesRes.body)).toBeTruthy();
        expect(movesRes.body).toContain(m.move);

        // Make move
        const moveRes = await request(app.getHttpServer())
          .post(`/games/${gameId}/moves`)
          .set('x-user-id', m.player)
          .send({ move: m.move })
          .expect(201); // Created status
      }

      // Game should be Checkmate now
      const gameAfter = await request(app.getHttpServer())
        .get(`/games/${gameId}`)
        .set('x-user-id', player1Id)
        .expect(200);

      expect(gameAfter.body.status).toBe('CHECKMATE');

      // Attempting to play after checkmate should fail
      await request(app.getHttpServer())
        .post(`/games/${gameId}/moves`)
        .set('x-user-id', player2Id)
        .send({ move: 'd6' })
        .expect(400); // Bad Request
    });
  });
});
