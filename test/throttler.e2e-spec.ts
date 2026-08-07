import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('ThrottlerGuard (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.DATABASE_URL = mongod.getUri();
    process.env.JWT_SECRET = 'test-secret';
    process.env.THROTTLE_TTL = '60000';
    process.env.THROTTLE_LIMIT = '5';
  });

  afterAll(async () => {
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    const { AppModule } = await import('./../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('should return 429 after exceeding limit', async () => {
    // 5 requests should pass (matching THROTTLE_LIMIT env var)
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/guest-users').expect(201);
    }

    // 6th request should be throttled
    await request(app.getHttpServer()).post('/guest-users').expect(429);
  });

  it('should not throttle health check endpoint', async () => {
    // Health check uses @SkipThrottle(), so it should always return 200
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer()).get('/').expect(200);
    }
  });
});
