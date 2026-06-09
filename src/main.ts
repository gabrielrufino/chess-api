import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { version, description } from '../package.json';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: true, credentials: true });
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

  app.useGlobalPipes(new ValidationPipe());
  app.useLogger(app.get(Logger));

  await app.listen(process.env.HTTP_SERVER_PORT || 3000);
}
bootstrap();
