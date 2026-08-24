// Clear a song's cached translation from MongoDB + Redis (all target languages).
// Matches by de-accented artist + title, so diacritics/apostrophes don't matter.
//
//   pnpm --filter @melofy/web clear-song "<artist>" "<title>"
//   e.g. pnpm --filter @melofy/web clear-song "Brymo" "Bá'núsọ"
//
// Reads MONGO_URI / REDIS_URL from the repo-root .env (loaded via dotenv-cli).
import mongoose from 'mongoose';
import Redis from 'ioredis';

const [artist, title] = process.argv.slice(2);
if (!artist || !title) {
  console.error('Usage: pnpm --filter @melofy/web clear-song "<artist>" "<title>"');
  process.exit(1);
}

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27018/melofy';
const REDIS = process.env.REDIS_URL || 'redis://localhost:16379';
const norm = (s) =>
  String(s || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const wantA = norm(artist);
const wantT = norm(title);

await mongoose.connect(MONGO);
const coll = mongoose.connection.collection('cachedtranslations');
const all = await coll.find({}).toArray();
const targets = all.filter((d) => norm(d.artist) === wantA && norm(d.title) === wantT);

if (targets.length === 0) {
  console.log(`Nothing cached for "${artist} — ${title}".`);
  await mongoose.disconnect();
  process.exit(0);
}

const redis = new Redis(REDIS);
for (const d of targets) {
  await coll.deleteOne({ _id: d._id });
  const r = await redis.del(`lyrics:${d.hash}`);
  console.log(`✓ cleared "${d.title}" [${d.targetLanguage}] — mongo + redis lyrics:${d.hash} (redis del=${r})`);
}
await redis.quit();
await mongoose.disconnect();
console.log(`Done — cleared ${targets.length} doc(s).`);
