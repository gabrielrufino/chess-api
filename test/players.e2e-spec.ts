import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { MongoMemoryServer } from 'mongodb-memory-server';
import faker from '@faker-js/faker';
import * as request from 'supertest';
import TestAgent from 'supertest/lib/agent';

import { AuthModule } from '../src/auth/auth.module';
import { AuthGuard } from '../src/auth/guards/auth.guard';
import { PlayerModule } from '../src/player/player.module';

describe('PlayerModule (e2e)', () => {
  let app: INestApplication;
  let client: TestAgent;
  let mongod: MongoMemoryServer;

  beforeEach(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        CacheModule.register({ isGlobal: true }),
        AuthModule,
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
          req.user = { sub: userId, isGuest: true };
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
    if (mongod) await mongod.stop();
  });

  describe('POST /players', () => {
    it('should create a player with a valid nickname', async () => {
      const authUserId = faker.datatype.uuid();

      const res = await client
        .post('/players')
        .set('x-user-id', authUserId)
        .send({ nickname: 'SwiftKnight1234' })
        .expect(HttpStatus.CREATED);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body._id).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.nickname).toBe('SwiftKnight1234');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.isGuest).toBe(true);
    });

    it('should return 400 when nickname is missing', async () => {
      const authUserId = faker.datatype.uuid();

      await client
        .post('/players')
        .set('x-user-id', authUserId)
        .send({})
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when nickname is too short', async () => {
      const authUserId = faker.datatype.uuid();

      await client
        .post('/players')
        .set('x-user-id', authUserId)
        .send({ nickname: 'ab' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 409 when nickname is already taken', async () => {
      const user1Id = faker.datatype.uuid();
      const user2Id = faker.datatype.uuid();
      const nickname = 'BoldBishop9999';

      // First player takes the nickname
      await client
        .post('/players')
        .set('x-user-id', user1Id)
        .send({ nickname })
        .expect(HttpStatus.CREATED);

      // Second player tries to use the same nickname
      const res = await client
        .post('/players')
        .set('x-user-id', user2Id)
        .send({ nickname })
        .expect(HttpStatus.CONFLICT);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.message).toContain('already taken');
    });
  });

  describe('GET /players', () => {
    it('should list all players', async () => {
      const authUserId = faker.datatype.uuid();
      await client
        .post('/players')
        .set('x-user-id', authUserId)
        .send({ nickname: 'CalmRook1111' });

      const res = await client
        .get('/players')
        .set('x-user-id', authUserId)
        .expect(HttpStatus.OK);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter players by nickname (partial, case-insensitive)', async () => {
      const user1Id = faker.datatype.uuid();
      const user2Id = faker.datatype.uuid();

      await client
        .post('/players')
        .set('x-user-id', user1Id)
        .send({ nickname: 'SwiftKnight4321' });

      await client
        .post('/players')
        .set('x-user-id', user2Id)
        .send({ nickname: 'IronBishop8888' });

      const res = await client
        .get('/players?nickname=swift')
        .set('x-user-id', user1Id)
        .expect(HttpStatus.OK);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.total).toBe(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.data[0].nickname).toBe('SwiftKnight4321');
    });

    it('should return empty list when no player matches the nickname filter', async () => {
      const authUserId = faker.datatype.uuid();

      const res = await client
        .get('/players?nickname=nonexistent_xyz')
        .set('x-user-id', authUserId)
        .expect(HttpStatus.OK);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.total).toBe(0);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /players/nickname-suggestion', () => {
    it('should return an available nickname suggestion', async () => {
      const authUserId = faker.datatype.uuid();

      const res = await client
        .get('/players/nickname-suggestion')
        .set('x-user-id', authUserId)
        .expect(HttpStatus.OK);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(typeof res.body.nickname).toBe('string');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.nickname.length).toBeGreaterThan(0);
    });

    it('should return a nickname not already taken', async () => {
      const authUserId = faker.datatype.uuid();

      // Get a suggestion
      const suggestionRes = await client
        .get('/players/nickname-suggestion')
        .set('x-user-id', authUserId)
        .expect(HttpStatus.OK);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const suggestedNickname = suggestionRes.body.nickname;

      // Verify it's not taken (no player with that nickname yet)
      const listRes = await client
        .get(`/players?nickname=${suggestedNickname as string}`)
        .set('x-user-id', authUserId)
        .expect(HttpStatus.OK);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(listRes.body.total).toBe(0);
    });
  });
});
