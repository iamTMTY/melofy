export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27018/melofy',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL || '864000', 10),
  defaultSourceLanguage: 'auto',
};
