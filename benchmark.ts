import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Player, PlayerSchema } from './src/player/schemas/player.schema';

async function run() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  await mongoose.connect(uri);
  const PlayerModel = mongoose.model(Player.name, PlayerSchema);

  // Insert test data
  const docs = [];
  for (let i = 0; i < 10000; i++) {
    docs.push({ userId: `user-${i}`, isGuest: false });
  }
  await PlayerModel.insertMany(docs);

  console.log('Running without lean()...');
  const start1 = performance.now();
  for (let i = 0; i < 50; i++) {
    await PlayerModel.find({ deletedAt: null });
  }
  const end1 = performance.now();
  console.log(`Without lean: ${(end1 - start1).toFixed(2)} ms`);

  console.log('Running with lean()...');
  const start2 = performance.now();
  for (let i = 0; i < 50; i++) {
    await PlayerModel.find({ deletedAt: null }).lean();
  }
  const end2 = performance.now();
  console.log(`With lean: ${(end2 - start2).toFixed(2)} ms`);

  await mongoose.disconnect();
  await mongod.stop();
}

run().catch(console.error);
