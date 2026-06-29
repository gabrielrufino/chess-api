import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Player, PlayerSchema } from './src/player/schemas/player.schema';

const PlayerModel = mongoose.model(Player.name, PlayerSchema);

async function run() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  // Clear the collection
  await PlayerModel.deleteMany({});

  // Insert a test document
  const player = await PlayerModel.create({ userId: 'test-user', isGuest: false });
  const id = player._id;

  const iterations = 5000;

  // Without lean
  const startWithoutLean = Date.now();
  for (let i = 0; i < iterations; i++) {
    await PlayerModel.find({ deletedAt: null });
  }
  const timeWithoutLean = Date.now() - startWithoutLean;
  console.log(`Without lean: ${timeWithoutLean}ms`);

  // With lean
  const startWithLean = Date.now();
  for (let i = 0; i < iterations; i++) {
    await PlayerModel.find({ deletedAt: null }).lean();
  }
  const timeWithLean = Date.now() - startWithLean;
  console.log(`With lean: ${timeWithLean}ms`);

  console.log(`Improvement: ${((timeWithoutLean - timeWithLean) / timeWithoutLean * 100).toFixed(2)}%`);

  await mongoose.disconnect();
  await mongod.stop();
}

run().catch(console.error);
