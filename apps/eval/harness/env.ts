import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(HERE, '../../../.env');

const fileEnv: Record<string, string> = {};
try {
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    // Values may be quoted ("http://…"); strip ONE matching pair of surrounding
    // quotes or the literal quote chars end up inside the value (an unparseable
    // URL, an API key that fails auth).
    const raw = t.slice(i + 1).trim();
    const unquoted =
      (raw.startsWith('"') && raw.endsWith('"') && raw.length > 1) ||
      (raw.startsWith("'") && raw.endsWith("'") && raw.length > 1)
        ? raw.slice(1, -1)
        : raw;
    fileEnv[t.slice(0, i).trim()] = unquoted;
  }
} catch {}

export function envGet(key: string): string {
  return process.env[key] || fileEnv[key] || '';
}
