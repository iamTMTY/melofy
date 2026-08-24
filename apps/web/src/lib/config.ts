export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27018/melofy',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openRouterApiKey: process.env.OPEN_ROUTER_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // Model to use for translation. Routing by slug:
  //   - any slug with "/" (e.g. "google/gemini-3.7-flash", "anthropic/claude-...")
  //                                   → OpenRouter (OPEN_ROUTER_API_KEY). This is
  //                                     the default path for Gemini.
  //   - bare "gemini..." (e.g. "gemini-flash-latest")
  //                                   → Google's OpenAI-compatible API direct
  //                                     (GEMINI_API_KEY).
  //   - any other bare name (e.g. "gpt-4o") → OpenAI direct (OPENAI_API_KEY)
  translationModel: process.env.OPENAI_MODEL || 'google/gemini-3.7-flash',
  // Two-step translation: a context/brief pass (theme + slang/idiom glossary) runs
  // first, then the line-by-line translation uses that brief. Improves slang/idiom
  // fidelity — the eval's weak axis. Set TWO_STEP_TRANSLATION=false to A/B against
  // the single-pass path.
  twoStepTranslation: process.env.TWO_STEP_TRANSLATION !== 'false',
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL || '864000', 10),
  defaultSourceLanguage: 'auto',
  // Free NEW-translation budget per IP per UTC day (cache hits don't count). 0 = unlimited.
  dailyTranslationLimit: parseInt(process.env.DAILY_TRANSLATION_LIMIT || '10', 10),
  // Salt for hashing IPs before storing rate-limit counters (privacy).
  rateLimitSalt: process.env.RATE_LIMIT_SALT || 'melofy-local-dev-salt',
  // RSA private key (PEM) for decrypting BYOK keys. Empty → an ephemeral keypair
  // is generated per process (fine for single-instance dev; set this in prod).
  byokPrivateKey: process.env.BYOK_PRIVATE_KEY || '',
  // PostHog analytics. Server capture uses POSTHOG_KEY (falls back to the public
  // one so a single key works); client uses the NEXT_PUBLIC_ one. All optional —
  // absent key ⇒ analytics is a no-op. Host defaults to PostHog US cloud.
  posthogKey: process.env.POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
  posthogHost: process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  // Langfuse LLM-call tracing (server-side). Optional — absent keys ⇒ tracing is
  // a no-op (no span processor is created). Same keys the eval harness uses.
  langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
  langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY || '',
  langfuseBaseUrl: process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
};
