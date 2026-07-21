import faker from '@faker-js/faker';
import * as request from 'supertest';
import { HttpStatus, INestApplication } from '@nestjs/common';

export async function createPlayer(
  app: INestApplication,
  nickname?: string,
): Promise<any> {
  const authUserId = faker.datatype.uuid();
  const playerNickname =
    nickname ??
    `${faker.name.firstName()}${Math.floor(Math.random() * 9000) + 1000}`;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
  const { body } = await request(app.getHttpServer())
    .post('/players')
    .set('x-user-id', authUserId)
    .send({ nickname: playerNickname })
    .expect(HttpStatus.CREATED);

  return { ...body, authUserId };
}
