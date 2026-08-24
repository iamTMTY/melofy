import { envGet } from './env.ts';

// Raw model call used for JUDGING (and optionally reference generation). Routes
// by model name, mirroring the app's own convention:
//   claude-*        -> Anthropic
//   contains "/"    -> OpenRouter
//   otherwise       -> OpenAI
// Candidate TRANSLATIONS do NOT go through here — those hit the running app so
// the eval exercises the real product pipeline.
export async function callModel(
  model: string,
  system: string,
  user: string,
  opts: { maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}
): Promise<string> {
  const maxTokens = opts.maxTokens ?? 800;
  const temperature = opts.temperature ?? 0;

  let url: string;
  let headers: Record<string, string>;
  let body: string;

  if (model.startsWith('claude')) {
    url = 'https://api.anthropic.com/v1/messages';
    headers = {
      'x-api-key': envGet('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
    body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      temperature,
    });
  } else {
    const useOpenRouter = model.includes('/');
    url = useOpenRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const key = useOpenRouter ? envGet('OPEN_ROUTER_API_KEY') : envGet('OPENAI_API_KEY');
    headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    if (useOpenRouter) headers['X-Title'] = 'Melofy-eval';
    body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
  }

  const res = await fetch(url, { method: 'POST', headers, body, signal: opts.signal });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${model} ${res.status}: ${text.slice(0, 200)}`);
  }
  const d: any = await res.json();
  return model.startsWith('claude')
    ? String(d.content?.[0]?.text ?? '').trim()
    : String(d.choices?.[0]?.message?.content ?? '').trim();
}
