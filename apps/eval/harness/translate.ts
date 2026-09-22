export async function translateViaProduct(
  productUrl: string,
  lines: string[],
  targetLanguage: string,
  model: string,
  artist: string,
  title: string,
  signal?: AbortSignal
): Promise<string[]> {
  const res = await fetch(`${productUrl.replace(/\/$/, '')}/api/eval/translate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lines, targetLanguage, model, artist, title }),
    signal,
  });
  if (!res.ok) {
    let msg = String(res.status);
    try {
      const e: any = await res.json();
      msg = e.error || msg;
    } catch {}
    throw new Error(`product /api/eval/translate → ${msg}`);
  }
  const d: any = await res.json();
  if (!Array.isArray(d.translated)) throw new Error('product returned no translation');
  return d.translated as string[];
}
