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
    // 100 requests should pass
    for (let i = 0; i < 100; i++) {
      await request(app.getHttpServer()).get('/').expect(200);
    }

    // 101st request should be throttled
    await request(app.getHttpServer()).get('/').expect(429);
  }, 30000);
});
