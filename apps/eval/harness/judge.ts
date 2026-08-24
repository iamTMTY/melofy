import { callModel } from './providers.ts';
import type { Scores } from './types.ts';

const JUDGE_SYS =
  'You are a strict evaluator. You are given the SOURCE lyrics, a trusted human-reviewed REFERENCE ' +
  'translation, and a CANDIDATE translation. Score the CANDIDATE 1-5 (5=best) for how well it matches ' +
  "the reference's meaning and quality. Return ONLY strict JSON: " +
  '{"fidelity":n,"fluency":n,"slang_idiom":n,"note":"<=15 words"}. ' +
  'fidelity=same meaning as reference; fluency=natural English; slang_idiom=slang/idioms as well as the reference.';

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export async function judge(
  judgeModel: string,
  language: string,
  source: string,
  reference: string,
  candidate: string,
  signal?: AbortSignal
): Promise<Scores> {
  const user = `LANGUAGE: ${language}\n\nSOURCE:\n${source}\n\nREFERENCE:\n${reference}\n\nCANDIDATE:\n${candidate}`;
  const raw = await callModel(judgeModel, JUDGE_SYS, user, { maxTokens: 200, temperature: 0, signal });
  try {
    const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    return {
      fidelity: num(j.fidelity),
      fluency: num(j.fluency),
      slang_idiom: num(j.slang_idiom),
      note: String(j.note ?? '').slice(0, 120),
    };
  } catch {
    return { fidelity: null, fluency: null, slang_idiom: null, note: 'judge-parse-error' };
  }
}
