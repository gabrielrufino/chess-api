import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { GameModule } from './game/game.module';
import { PlayerModule } from './player/player.module';
import { AuthModule } from './auth/auth.module';
import { GuestUserModule } from './guest-user/guest-user.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [`${__dirname}/**/*.entity{.ts,.js}`],
      synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
      logging: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
      },
    }),
    TerminusModule,
    AuthModule,
    GuestUserModule,
    PlayerModule,
    GameModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
