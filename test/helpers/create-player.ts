import faker from '@faker-js/faker';
import * as request from 'supertest';
import { PlayerEntity } from 'src/player/entities/player.entity';
import { CreatePlayerDto } from 'src/player/dto/create-player.dto';
import { HttpStatus, INestApplication } from '@nestjs/common';

export async function createPlayer(
  app: INestApplication,
): Promise<PlayerEntity> {
  const { body } = await request(app.getHttpServer())
    .post('/players')
    .send({
      name: faker.name.findName(),
    } as CreatePlayerDto)
    .expect(HttpStatus.CREATED);

  return body;
}
