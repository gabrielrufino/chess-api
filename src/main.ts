import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { version, description } from '../package.json';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  if (process.env.TRUST_PROXY) {
    const rawTrustProxy = process.env.TRUST_PROXY;
    let trustProxy: boolean | number | string = rawTrustProxy;

    if (/^\d+$/.test(rawTrustProxy)) {
      trustProxy = Number(rawTrustProxy);
    } else if (rawTrustProxy === 'true') {
      trustProxy = true;
    } else if (rawTrustProxy === 'false') {
      trustProxy = false;
    }

    app.set('trust proxy', trustProxy);
  }

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.use(helmet());

  const documentation = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Chess API')
      .setDescription(description)
      .setVersion(version)
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api', app, documentation);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useLogger(app.get(Logger));

  try {
    const connection = app.get<Connection>(getConnectionToken());
    await connection.syncIndexes();
  } catch (error) {
    app
      .get(Logger)
      .error(error instanceof Error ? error.message : String(error));
  }

  await app.listen(process.env.HTTP_SERVER_PORT || 3000);
}
void bootstrap();
