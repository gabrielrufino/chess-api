import faker from '@faker-js/faker';
import * as request from 'supertest';
import { HttpStatus, INestApplication } from '@nestjs/common';

export async function createPlayer(app: INestApplication): Promise<any> {
  const authUserId = faker.datatype.uuid();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
  const { body } = await request(app.getHttpServer())
    .post('/players')
    .set('x-user-id', authUserId)
    .send({
      name: faker.name.findName(),
    })
    .expect(HttpStatus.CREATED);

  return { ...body, authUserId };
}
