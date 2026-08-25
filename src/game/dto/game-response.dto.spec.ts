/* eslint-disable */
import { GameDto, GameListDto } from './game-response.dto';
import { PlayerDto } from '../../player/dto/player-response.dto';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';

describe('GameDto Decorators', () => {
  it('should evaluate type functions for swagger properties without calling them', () => {
    const metaWhite = Reflect.getMetadata(
      'swagger/apiModelProperties',
      GameDto.prototype,
      'whitePlayer',
    );
    expect(metaWhite?.type).toBeDefined();

    const metaBlack = Reflect.getMetadata(
      'swagger/apiModelProperties',
      GameDto.prototype,
      'blackPlayer',
    );
    expect(metaBlack?.type).toBeDefined();

    const metaData = Reflect.getMetadata(
      'swagger/apiModelProperties',
      GameListDto.prototype,
      'data',
    );
    expect(metaData?.type).toBeDefined();
  });

  it('should transform to correct classes', () => {
    const gameList = plainToInstance(GameListDto, {
      data: [{ whitePlayer: {}, blackPlayer: {} }],
    });
    expect(gameList.data[0]).toBeInstanceOf(GameDto);
    expect(gameList.data[0].whitePlayer).toBeInstanceOf(PlayerDto);
    expect(gameList.data[0].blackPlayer).toBeInstanceOf(PlayerDto);
  });
});
