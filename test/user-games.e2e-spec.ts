import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthModule } from '../src/auth/auth.module';
import { GameModule } from '../src/game/game.module';
import { PlayerModule } from '../src/player/player.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { JwtService } from '@nestjs/jwt';

describe('UserGamesController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let jwtService: JwtService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
    process.env.JWT_SECRET = 'test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        CacheModule.register({ isGlobal: true }),
        AuthModule,
        GameModule,
        PlayerModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
    await app.close();
  });

  it('GET /users/me/games/export (unauthorized)', () => {
    return request(app.getHttpServer())
      .get('/users/me/games/export')
      .expect(401);
  });

  it('GET /users/me/games/export (authorized, player not found)', () => {
    const token = jwtService.sign({ sub: 'non-existent-user', isGuest: false });
    return request(app.getHttpServer())
      .get('/users/me/games/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /users/me/games/export (authorized, successful)', async () => {
    const token = jwtService.sign({ sub: 'user-with-games', isGuest: false });
    const client = request(app.getHttpServer());

    await client
      .post('/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: 'Exporter' })
      .expect(201);

    const response = await client
      .get('/users/me/games/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="meu_historico_xadrez.csv"',
    );
    expect(response.text).toContain('Data,Adversario,Cor,Resultado,PGN');
  });
});
