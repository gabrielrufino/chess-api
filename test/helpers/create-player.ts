import faker from '@faker-js/faker';
import request from 'supertest';
import { Player } from 'src/player/entities/player.entity';
import { CreatePlayerDto } from 'src/player/dto/create-player.dto';
import { HttpStatus, INestApplication } from '@nestjs/common';

export async function createPlayer(app: INestApplication): Promise<Player> {
  const { body } = await request(app.getHttpServer())
    .post('/players')
    .send({
      name: faker.name.findName(),
    } as CreatePlayerDto)
    .expect(HttpStatus.CREATED);

  return body;
}
