import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { GameModule } from './game/game.module';
import { PlayerModule } from './player/player.module';
import { AuthModule } from './auth/auth.module';
import { GuestUserModule } from './guest-user/guest-user.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.DATABASE_URL),
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
