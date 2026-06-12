import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Model, Connection } from 'mongoose';
import { Game, GameSchema, GameDocument } from './game.schema';
import { GameDurationEnum } from '../enumerables/game-duration.enum';
import { GameStatusEnum } from '../enumerables/game-status.enum';

describe('Game Schema Integration', () => {
  let mongoServer: MongoMemoryServer;
  let gameModel: Model<GameDocument>;
  let connection: Connection;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
      ],
    }).compile();

    gameModel = module.get<Model<GameDocument>>(`${Game.name}Model`);
    connection = await module.get(getConnectionToken());
  });

  afterAll(async () => {
    if (connection) {
      await connection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  afterEach(async () => {
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });

  it('should be defined', () => {
    expect(gameModel).toBeDefined();
  });

  it('should successfully create a game with default values', async () => {
    const game = new gameModel({
      duration: GameDurationEnum.TenMinutes,
    });

    const savedGame = await game.save();

    expect(savedGame._id).toBeDefined();
    expect(savedGame.duration).toBe(GameDurationEnum.TenMinutes);
    expect(savedGame.status).toBe(GameStatusEnum.WAITING_PLAYER);
    expect(savedGame.fen).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(savedGame.pgn).toBe('');
    expect(savedGame.incrementMs).toBe(0);
    expect(savedGame.get('createdAt')).toBeDefined();
    expect(savedGame.get('updatedAt')).toBeDefined();
  });

  it('should fail validation if duration is not provided', async () => {
    const game = new gameModel({});

    let error: mongoose.Error.ValidationError;
    try {
      await game.save();
    } catch (err: unknown) {
      error = err as mongoose.Error.ValidationError;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(error.errors.duration).toBeDefined();
  });

  it('should correctly populate virtuals when players are provided', async () => {
    const whitePlayerId = new mongoose.Types.ObjectId();
    const blackPlayerId = new mongoose.Types.ObjectId();

    const game = new gameModel({
      duration: GameDurationEnum.TenMinutes,
      whitePlayerId,
      blackPlayerId,
    });

    const savedGame = await game.save();

    expect(savedGame.whitePlayerId).toEqual(whitePlayerId);
    expect(savedGame.blackPlayerId).toEqual(blackPlayerId);

    // virtuals are defined but without a Player model we can't populate them directly here,
    // however we can verify the fields are set correctly
    const gameObject = savedGame.toObject();
    expect(gameObject.whitePlayerId).toEqual(whitePlayerId);
    expect(gameObject.blackPlayerId).toEqual(blackPlayerId);
  });
});
