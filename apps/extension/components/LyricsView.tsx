import { useEffect, useMemo, useRef, useState } from 'react';
import './lyrics-view.css';
import { useNowPlaying } from '../lib/nowplaying';
import { requestLyrics, requestTranslation, getCachedTranslation, setCachedTranslation } from '../lib/api';
import { PREFS_KEY, DEFAULT_PREFS, type Prefs } from '../lib/config';
import type { LrcLine } from '../lib/lrc';

// The lyrics content itself — rendered INTO YouTube Music's native lyrics tab
// (no FAB, no panel chrome). Settings live in the popup and are read here via
// PREFS_KEY, reactively, so changing them applies live.

// Highlight slightly BEFORE the timestamp to cancel interpolation+paint latency
// so the active line lands on the beat. Tunable.
const SYNC_LOOKAHEAD_MS = 200;
const trackKey = (artist: string, title: string) => `${artist} — ${title}`;

export function LyricsView() {
  const np = useNowPlaying(150);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [lines, setLines] = useState<LrcLine[]>([]);
  const [synced, setSynced] = useState(false);
  const [translated, setTranslated] = useState<string[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'translating' | 'error'>('idle');
  const [error, setError] = useState('');
  const activeRef = useRef<HTMLDivElement>(null);

  const track = np?.track;
  const key = track ? trackKey(track.artist, track.title) : '';

  // Prefs: load + stay in sync with popup edits.
  useEffect(() => {
    browser.storage.local.get(PREFS_KEY).then((r) => {
      const p = r[PREFS_KEY] as Partial<Prefs> | undefined;
      if (p) setPrefs((cur) => ({ ...cur, ...p }));
    });
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes[PREFS_KEY]) {
        setPrefs((cur) => ({ ...cur, ...(changes[PREFS_KEY].newValue as Partial<Prefs>) }));
      }
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

  // Fetch lyrics on track change.
  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    setStatus('loading');
    setError('');
    setLines([]);
    setTranslated(null);
    requestLyrics({ artist: track.artist, title: track.title, album: track.album, durationMs: track.durationMs }).then((res) => {
      if (cancelled) return;
      if (res.ok && res.lines?.length) {
        setLines(res.lines);
        setSynced(!!res.synced);
        setStatus('idle');
      } else {
        setStatus('error');
        setError(res.error || "I couldn't find lyrics for this track.");
      }
    });
    return () => { cancelled = true; };
  }, [key]);

  // Translate (cache first) when enabled and lyrics are present.
  useEffect(() => {
    if (!track || !prefs.autoTranslate || lines.length === 0) return;
    let cancelled = false;
    (async () => {
      const cached = await getCachedTranslation(track.artist, track.title, prefs.targetLanguage);
      if (cancelled) return;
      if (cached && cached.length === lines.length) { setTranslated(cached); return; }
      setStatus('translating');
      const res = await requestTranslation({
        lines: lines.map((l) => l.text),
        // Send the real LRC timings so the shared server cache stores THOSE and
        // not placeholders — the web app reads timings out of that same cache.
        timeMs: lines.map((l) => l.timeMs),
        targetLanguage: prefs.targetLanguage,
        artist: track.artist,
        title: track.title,
      });
      if (cancelled) return;
      if (res.ok && res.translated) {
        setTranslated(res.translated);
        setStatus('idle');
        void setCachedTranslation(track.artist, track.title, prefs.targetLanguage, res.translated);
      } else {
        setStatus('error');
        setError(res.error || 'Something went wrong translating this song.');
      }
    })();
    return () => { cancelled = true; };
  }, [key, lines, prefs.autoTranslate, prefs.targetLanguage]);

  // Smooth playback clock: re-anchor {pos, at} only when the reading changes, then
  // dead-reckon with wall-clock between anchors. 100ms tick drives re-renders.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, []);
  const clockRef = useRef<{ pos: number; at: number; playing: boolean }>({ pos: 0, at: 0, playing: false });
  if (np && (np.positionMs !== clockRef.current.pos || np.isPlaying !== clockRef.current.playing)) {
    clockRef.current = { pos: np.positionMs, at: np.capturedAt, playing: np.isPlaying };
  }
  const clock = clockRef.current;
  const positionMs = np
    ? clock.pos + (clock.playing ? Math.min(Math.max(0, Date.now() - clock.at), 2000) + SYNC_LOOKAHEAD_MS : 0)
    : 0;

  const activeIndex = useMemo(() => {
    if (!synced) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].timeMs != null && (lines[i].timeMs as number) <= positionMs) idx = i;
      else break;
    }
    return idx;
  }, [lines, positionMs, synced]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIndex]);

  const showTranslation = prefs.autoTranslate && !!translated;
  // 'learn' flips the pair so the original leads; 'both' gives them equal weight.
  const originalLeads = prefs.readingPriority === 'learn';

  return (
    <div
      className="melofy-embed"
      data-size={prefs.fontSize}
      data-priority={prefs.readingPriority ?? 'understand'}
      data-focus={prefs.focusBlur ? 'blur' : undefined}
    >
      <div className="melofy-lines">
        {status === 'loading' && <div className="melofy-state">Loading lyrics…</div>}
        {status === 'error' && <div className="melofy-state melofy-error">{error}</div>}
        {status !== 'loading' &&
          lines.map((line, i) => {
            const isActive = i === activeIndex;
            const isPast = synced && i < activeIndex;
            const tr = showTranslation && translated ? translated[i] : undefined;
            const pair = tr && tr !== line.text ? (originalLeads ? [line.text, tr] : [tr, line.text]) : [tr ?? line.text, null];
            const [primary, secondary] = pair;
            return (
              <div
                key={i}
                ref={isActive ? activeRef : undefined}
                className={`melofy-line${isActive ? ' is-active' : ''}${isPast ? ' is-past' : ''}${synced ? '' : ' is-unsynced'}`}
              >
                <div className="melofy-line-primary">{primary}</div>
                {secondary && <div className="melofy-line-secondary">{secondary}</div>}
              </div>
            );
          })}
        {status !== 'loading' && !synced && lines.length > 0 && (
          <div className="melofy-state melofy-muted">Unsynced lyrics — line highlighting isn&rsquo;t available.</div>
        )}
      </div>
    </div>
  );
}
