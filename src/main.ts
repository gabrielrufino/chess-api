import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { version, description } from '../package.json';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  const documentation = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Chess API')
      .setDescription(description)
      .setVersion(version)
      .build(),
  );
  SwaggerModule.setup('api', app, documentation);

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(3000);
}
bootstrap();
