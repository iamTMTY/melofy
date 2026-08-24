import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read the repo-root .env for API keys (judge / reference models). The eval app
// never writes it and never ships — this is a local dev tool. process.env wins
// if a key is already exported.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(HERE, '../../../.env'); // harness -> app -> eval -> repo root

const fileEnv: Record<string, string> = {};
try {
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    fileEnv[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
} catch {
  // No .env at repo root — rely entirely on process.env.
}

export function envGet(key: string): string {
  return process.env[key] || fileEnv[key] || '';
}
