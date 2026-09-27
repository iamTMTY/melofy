import { useEffect, useMemo, useRef, useState } from 'react';
import './lyrics-view.css';
import { useNowPlaying } from '../lib/nowplaying';
import { requestLyrics, requestTranslation, getCachedTranslation, setCachedTranslation } from '../lib/api';
import { PREFS_KEY, DEFAULT_PREFS, type Prefs } from '../lib/config';
import type { LrcLine } from '../lib/lrc';

// Highlight slightly BEFORE the timestamp to cancel interpolation+paint latency
// so the active line lands on the beat. Tunable.
const SYNC_LOOKAHEAD_MS = 200;
const trackKey = (t: { artist: string; title: string; album?: string; durationMs?: number }) =>
  `${t.artist} — ${t.title} — ${t.album ?? ''} — ${t.durationMs ?? ''}`;

function centerActiveLine(scroller: HTMLDivElement | null, line: HTMLDivElement | null, behavior: ScrollBehavior) {
  if (!scroller || !line || !line.getClientRects().length) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const lineRect = line.getBoundingClientRect();
  scroller.scrollTo({
    top: scroller.scrollTop + lineRect.top - scrollerRect.top - (scroller.clientHeight - lineRect.height) / 2,
    behavior,
  });
}

export function LyricsView() {
  const np = useNowPlaying(150);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [lines, setLines] = useState<LrcLine[]>([]);
  const [synced, setSynced] = useState(false);
  const [translated, setTranslated] = useState<string[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'translating' | 'error'>('loading');
  const [loadedKey, setLoadedKey] = useState('');
  const [translatedKey, setTranslatedKey] = useState('');
  const [error, setError] = useState('');
  const [followPlayback, setFollowPlayback] = useState(true);
  const activeRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<HTMLDivElement>(null);

  const track = np?.track;
  const key = track ? trackKey(track) : '';

  useEffect(() => setFollowPlayback(true), [key]);

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

  // NOTE: requestLyrics() is a runtime MESSAGE to background.ts, which fetches
  // lrclib.net directly and answers { ok, lines, synced }. It never touches the
  // web app's /api/lyrics/search, so that route's 422-on-unsynced contract does
  // not apply here: plain-text tracks arrive as { ok: true, synced: false } and
  // render dimmed with the "Unsynced lyrics" note below. The two surfaces differ
  // on purpose.
  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    setStatus('loading');
    setError('');
    setLines([]);
    setTranslated(null);
    setTranslatedKey('');
    requestLyrics({ artist: track.artist, title: track.title, album: track.album, durationMs: track.durationMs }).then((res) => {
      if (cancelled) return;
      if (res.ok && res.lines?.length) {
        setLines(res.lines);
        setSynced(!!res.synced);
        setLoadedKey(key);
        setStatus('idle');
      } else {
        setLoadedKey(key);
        setStatus('error');
        setError(res.error || "I couldn't find lyrics for this track.");
      }
    }).catch((err) => {
      if (cancelled) return;
      console.error('[Melofy] lyrics request failed:', err);
      setLoadedKey(key);
      setStatus('error');
      setError("I couldn't reach Melofy to load lyrics. Try playing the track again.");
    });
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    if (!track || !prefs.autoTranslate || lines.length === 0 || loadedKey !== key) return;
    let cancelled = false;
    (async () => {
      setStatus('translating');
      setError('');
      setTranslated(null);
      setTranslatedKey('');
      const recording = { album: track.album, durationMs: track.durationMs };
      const cached = await getCachedTranslation(track.artist, track.title, prefs.targetLanguage, recording);
      if (cancelled) return;
      if (cached && cached.length === lines.length) {
        setTranslated(cached);
        setTranslatedKey(`${key}:${prefs.targetLanguage}`);
        setStatus('idle');
        return;
      }
      const res = await requestTranslation({
        lines: lines.map((l) => l.text),
        timeMs: lines.map((l) => l.timeMs),
        targetLanguage: prefs.targetLanguage,
        artist: track.artist,
        title: track.title,
        album: track.album,
        durationMs: track.durationMs,
      });
      if (cancelled) return;
      if (res.ok && res.translated) {
        setTranslated(res.translated);
        setTranslatedKey(`${key}:${prefs.targetLanguage}`);
        setStatus('idle');
        void setCachedTranslation(track.artist, track.title, prefs.targetLanguage, res.translated, recording);
      } else {
        setStatus('error');
        setError(res.error || 'Something went wrong translating this song.');
      }
    })().catch((err) => {
      if (cancelled) return;
      console.error('[Melofy] translation request failed:', err);
      setStatus('error');
      setError("I couldn't reach Melofy to translate this song.");
    });
    return () => { cancelled = true; };
  }, [key, loadedKey, lines, prefs.autoTranslate, prefs.targetLanguage]);

  useEffect(() => {
    if (!prefs.autoTranslate) setStatus((current) => current === 'translating' ? 'idle' : current);
  }, [prefs.autoTranslate]);

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
    if (followPlayback) centerActiveLine(linesRef.current, activeRef.current, 'smooth');
  }, [activeIndex, followPlayback, translatedKey]);

  useEffect(() => {
    const root = embedRef.current?.getRootNode();
    const host = root instanceof ShadowRoot ? root.host : null;
    if (!host) return;
    const observer = new MutationObserver(() => {
      if (host.hasAttribute('hidden') || !followPlayback) return;
      requestAnimationFrame(() => {
        centerActiveLine(linesRef.current, activeRef.current, 'auto');
      });
    });
    observer.observe(host, { attributes: true, attributeFilter: ['hidden', 'data-fullscreen'] });
    return () => observer.disconnect();
  }, [followPlayback]);

  const isLoading = !track || loadedKey !== key || status === 'loading';
  const showTranslation = prefs.autoTranslate && translatedKey === `${key}:${prefs.targetLanguage}` && !!translated;
  const originalLeads = prefs.readingPriority === 'learn';

  return (
    <div
      ref={embedRef}
      className="melofy-embed"
      data-size={prefs.fontSize}
      data-priority={prefs.readingPriority ?? 'understand'}
      data-focus={prefs.focusBlur ? 'blur' : undefined}
    >
      {track?.albumArtUrl && (
        <div className="melofy-art-background" aria-hidden="true">
          <img src={track.albumArtUrl} alt="" />
        </div>
      )}
      {status === 'translating' && !isLoading && (
        <div className="melofy-progress" role="status" aria-live="polite">
          <span className="melofy-progress-spinner" aria-hidden="true" />
          Translating
        </div>
      )}
      {synced && !followPlayback && activeIndex >= 0 && (
        <button className="melofy-follow" type="button" onClick={() => setFollowPlayback(true)}>
          Follow current line
        </button>
      )}
      <div
        ref={linesRef}
        className="melofy-lines"
        role="region"
        aria-label="Lyrics"
        tabIndex={0}
        onWheelCapture={(event) => { event.stopPropagation(); if (synced) setFollowPlayback(false); }}
        onTouchStartCapture={(event) => { event.stopPropagation(); if (synced) setFollowPlayback(false); }}
        onPointerDownCapture={() => { if (synced) setFollowPlayback(false); }}
        onKeyDownCapture={(event) => {
          if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
            event.stopPropagation();
            if (synced) setFollowPlayback(false);
          }
        }}
      >
        {isLoading && (
          <div className="melofy-skeleton" role="status" aria-label="Loading lyrics">
            <span /><span /><span /><span /><span />
          </div>
        )}
        {!isLoading && status === 'error' && <div className="melofy-state melofy-error">{error}</div>}
        {!isLoading && !synced && lines.length > 0 && (
          <div className="melofy-unsynced-note">Unsynced lyrics · Scroll to read</div>
        )}
        {!isLoading &&
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
      </div>
    </div>
  );
}
