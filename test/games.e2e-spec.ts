import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import faker from '@faker-js/faker';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';

import { AuthModule } from '../src/auth/auth.module';
import { AuthGuard } from '../src/auth/guards/auth.guard';
import { GameModule } from '../src/game/game.module';
import { PlayerModule } from '../src/player/player.module';
import { createPlayer } from './helpers/create-player';
import { GameDurationEnum } from 'src/game/enumerables/game-duration.enum';
import TestAgent from 'supertest/lib/agent';

describe('GameModule (e2e)', () => {
  let app: INestApplication;
  let client: TestAgent;

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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const req = context.switchToHttp().getRequest();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const userId = req.headers['x-user-id'] || faker.datatype.uuid();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
          req.user = { sub: userId, isGuest: true, username: 'test' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    await app.init();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { authUserId } = await createPlayer(app);

      const response = await client
        .post('/games')
        .set('x-user-id', authUserId)
        .send({
          duration: GameDurationEnum.OneMinute,
        });

      expect(response.status).toBe(HttpStatus.CREATED);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(response.body.whitePlayerId).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(response.body.blackPlayerId).toBeUndefined();
    });

    it('Should return a validation error when does not receive duration', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { authUserId } = await createPlayer(app);

      return request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', authUserId)
        .send({})
        .expect(400);
    });

    it('Should return an error when the player does not exist', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', faker.datatype.uuid()) // invalid user
        .send({
          duration: GameDurationEnum.FiveMinutes,
        })
        .expect(HttpStatus.NOT_FOUND)
        .expect({
          message: 'Player not found',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('Should join an existing waiting game', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { authUserId: player1Id } = await createPlayer(app);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { authUserId: player2Id } = await createPlayer(app);

      // Player 1 creates game
      const res1 = await request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', player1Id)
        .send({ duration: GameDurationEnum.FiveMinutes });

      expect(res1.status).toBe(HttpStatus.CREATED);

      // Player 2 joins gam
      const res2 = await request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', player2Id)
        .send({ duration: GameDurationEnum.FiveMinutes });

      expect(res2.status).toBe(HttpStatus.CREATED);

      // Should be the same game ID
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res2.body._id).toBe(res1.body._id);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res2.body.whitePlayerId).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { authUserId: player1Id } = await createPlayer(app);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { authUserId: player2Id } = await createPlayer(app);

      // Player 1 creates game
      const res1 = await request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', player1Id)
        .send({ duration: GameDurationEnum.FiveMinutes });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(boardRes.body.fen).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(boardRes.body.board).toBeDefined();

      // Scholar's Mate Sequence
      const moves = [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { player: player1Id, move: 'e4' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { player: player2Id, move: 'e5' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { player: player1Id, move: 'Bc4' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { player: player2Id, move: 'Nc6' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { player: player1Id, move: 'Qh5' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { player: player2Id, move: 'Nf6' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        await request(app.getHttpServer())
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(gameAfter.body.status).toBe('CHECKMATE');

      // Attempting to play after checkmate should fail
      await request(app.getHttpServer())
        .post(`/games/${gameId}/moves`)
        .set('x-user-id', player2Id)
        .send({ move: 'd6' })
        .expect(400); // Bad Request
    });
  });

  describe('Time Control', () => {
    it('Should allow a player to claim timeout when opponent time expires', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { authUserId: player1Id } = await createPlayer(app);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { authUserId: player2Id } = await createPlayer(app);

      // Player 1 creates game (1min)
      const res1 = await request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', player1Id)
        .send({ duration: GameDurationEnum.OneMinute });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const gameId = res1.body._id;

      // Player 2 joins game
      await request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', player2Id)
        .send({ duration: GameDurationEnum.OneMinute });

      // Hack the database to make it look like 2 minutes have passed
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const gameModel = app.get(getModelToken('Game'));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      await gameModel.findByIdAndUpdate(gameId, {
        lastMoveAt: new Date(Date.now() - 120000),
      });

      // Player 2 claims timeout because player 1 didn't move
      const claimRes = await request(app.getHttpServer())
        .post(`/games/${gameId}/claim-timeout`)
        .set('x-user-id', player2Id)
        .expect(201);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(claimRes.body.status).toBe('TIMEOUT');
    });

    it('Should throw bad request if a move is made after time expires', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { authUserId: player1Id } = await createPlayer(app);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { authUserId: player2Id } = await createPlayer(app);

      const res1 = await request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', player1Id)
        .send({ duration: GameDurationEnum.OneMinute });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const gameId = res1.body._id;

      await request(app.getHttpServer())
        .post('/games')
        .set('x-user-id', player2Id)
        .send({ duration: GameDurationEnum.OneMinute });

      // Hack the database
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const gameModel = app.get(getModelToken('Game'));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      await gameModel.findByIdAndUpdate(gameId, {
        lastMoveAt: new Date(Date.now() - 120000),
      });

      // Player 1 tries to move but time is up
      await request(app.getHttpServer())
        .post(`/games/${gameId}/moves`)
        .set('x-user-id', player1Id)
        .send({ move: 'e4' })
        .expect(400); // Bad Request
    });
  });

  describe('WebSockets', () => {
    let ioClient: Socket;

    afterEach(() => {
      if (ioClient) {
        ioClient.disconnect();
      }
    });

    it('Should receive game-updated event when a move is made', (done) => {
      app
        .listen(0)
        .then(async () => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          const port = app.getHttpServer().address().port;

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const { authUserId: player1Id } = await createPlayer(app);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const { authUserId: player2Id } = await createPlayer(app);

          const res1 = await request(app.getHttpServer())
            .post('/games')
            .set('x-user-id', player1Id)
            .send({ duration: GameDurationEnum.FiveMinutes });

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const gameId = res1.body._id;

          await request(app.getHttpServer())
            .post('/games')
            .set('x-user-id', player2Id)
            .send({ duration: GameDurationEnum.FiveMinutes });

          ioClient = io(`http://127.0.0.1:${port}`, {
            transports: ['websocket'],
            forceNew: true,
            reconnection: false,
          });

          let moveMade = false;

          ioClient.on('game-updated', (payload: any) => {
            if (!moveMade) return;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(payload.game).toBeDefined();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(payload.board).toBeDefined();
            done();
          });

          ioClient.on('connect', () => {
            ioClient.emit('join-game', gameId, () => {
              moveMade = true;
              void (async () => {
                await request(app.getHttpServer())
                  .post(`/games/${gameId}/moves`)
                  .set('x-user-id', player1Id)
                  .send({ move: 'e4' });
              })();
            });
          });
        })
        .catch(done);
    });
  });
});
