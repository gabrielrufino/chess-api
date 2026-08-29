import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { Game, GameDocument, GameSchema } from './game.schema';
import { Player, PlayerSchema } from '../../player/schemas/player.schema';
import { GameDurationEnum } from '../enumerables/game-duration.enum';
import { GameStatusEnum } from '../enumerables/game-status.enum';

describe('Game Schema Integration', () => {
  let module: TestingModule;
  let gameModel: Model<GameDocument>;
  let playerModel: Model<Player>;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
        MongooseModule.forFeature([
          { name: Player.name, schema: PlayerSchema },
        ]),
      ],
    }).compile();

    gameModel = module.get<Model<GameDocument>>(getModelToken(Game.name));
    playerModel = module.get<Model<Player>>(getModelToken(Player.name));
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  afterEach(async () => {
    await gameModel.deleteMany({});
    await playerModel.deleteMany({});
  });

  it('should be defined', () => {
    expect(gameModel).toBeDefined();
    expect(playerModel).toBeDefined();
  });

  it('should successfully create a game with default values', async () => {
    const gameData = {
      duration: GameDurationEnum.TenMinutes,
    };

    const game = await gameModel.create(gameData);

    expect(game.duration).toBe(GameDurationEnum.TenMinutes);
    expect(game.fen).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(game.pgn).toBe('');
    expect(game.status).toBe(GameStatusEnum.WAITING_PLAYER);
    expect(game.incrementMs).toBe(0);
  });

  it('should fail validation if duration is not provided', async () => {
    const gameData = {};

    await expect(gameModel.create(gameData)).rejects.toThrow();
  });

  it('should correctly populate virtuals when players are provided', async () => {
    const player1 = await playerModel.create({
      userId: 'user1',
      isGuest: false,
      nickname: 'player1',
    });

    const player2 = await playerModel.create({
      userId: 'user2',
      isGuest: false,
      nickname: 'player2',
    });

    const game = await gameModel.create({
      duration: GameDurationEnum.TenMinutes,
      whitePlayerId: player1._id,
      blackPlayerId: player2._id,
    });

    const populatedGame = await gameModel
      .findById(game._id)
      .populate('whitePlayer')
      .populate('blackPlayer')
      .exec();

    expect(populatedGame?.whitePlayer?.userId).toBe('user1');
    expect(populatedGame?.blackPlayer?.userId).toBe('user2');
  });

  it('should include virtuals in toJSON output', async () => {
    const player1 = await playerModel.create({
      userId: 'user1',
      isGuest: false,
      nickname: 'player1',
    });

    const game = await gameModel.create({
      duration: GameDurationEnum.TenMinutes,
      whitePlayerId: player1._id,
    });

    const populatedGame = await gameModel
      .findById(game._id)
      .populate('whitePlayer')
      .exec();

    const json = populatedGame.toJSON() as any;

    expect(json.whitePlayer).toBeDefined();
    expect(json.whitePlayer.userId).toBe('user1');
    expect(json.id).toBeDefined(); // Test virtual 'id' mapping of '_id'
  });

  it('should include virtuals in toObject output', async () => {
    const player1 = await playerModel.create({
      userId: 'user1',
      isGuest: false,
      nickname: 'player1',
    });

    const game = await gameModel.create({
      duration: GameDurationEnum.TenMinutes,
      whitePlayerId: player1._id,
    });

    const populatedGame = await gameModel
      .findById(game._id)
      .populate('whitePlayer')
      .exec();

    const obj = populatedGame.toObject() as any;

    expect(obj.whitePlayer).toBeDefined();
    expect(obj.whitePlayer.userId).toBe('user1');
    expect(obj.id).toBeDefined();
  });
});
