import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type CSSProperties } from 'react';
import { SUPPORTED_LANGUAGES } from '@melofy/core';
import './lyrics-widget.css';
import { useNowPlaying } from '../lib/nowplaying';
import { requestLyrics, requestTranslation, getCachedTranslation, setCachedTranslation } from '../lib/api';
import { DEFAULT_TARGET_LANGUAGE, PREFS_KEY } from '../lib/config';
import { track as trackEvent } from '../lib/analytics';
import type { LrcLine } from '../lib/lrc';

type FontSize = 'small' | 'medium' | 'large';
interface Prefs {
  targetLanguage: string;
  autoTranslate: boolean;
  open: boolean;
  fontSize: FontSize; // S/M/L, mirroring the web app
  enlarged: boolean; // false = half height (default), true = full height
  pos: { x: number; y: number } | null; // dragged position; null = default anchor
}
// Starts COLLAPSED (a small FAB) so it never intrudes on first load — the user
// taps the launcher to open the panel, and the panel collapses back to it.
// Starts at HALF height (enlarged:false) and default anchored top-right (pos:null).
const DEFAULT_PREFS: Prefs = {
  targetLanguage: DEFAULT_TARGET_LANGUAGE,
  autoTranslate: true,
  open: false,
  fontSize: 'medium',
  enlarged: false,
  pos: null,
};

const FONT_SIZES: FontSize[] = ['small', 'medium', 'large'];

// Highlight the line slightly BEFORE its timestamp, to cancel the small residual
// latency (interpolation tick + paint) and give the natural karaoke "lead" so the
// active line lands on the beat rather than a moment after you hear it. Tunable.
const SYNC_LOOKAHEAD_MS = 200;

const trackKey = (artist: string, title: string) => `${artist} — ${title}`;

function Glyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

// Expand (arrows out) when at half height; shrink (arrows in) when enlarged.
function ResizeIcon({ enlarged }: { enlarged: boolean }) {
  return enlarged ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

export function LyricsWidget() {
  const np = useNowPlaying(150);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [lines, setLines] = useState<LrcLine[]>([]);
  const [synced, setSynced] = useState(false);
  const [translated, setTranslated] = useState<string[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'translating' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const track = np?.track;
  const key = track ? trackKey(track.artist, track.title) : '';

  useEffect(() => {
    browser.storage.local.get(PREFS_KEY).then((r) => {
      const p = r[PREFS_KEY] as Partial<Prefs> | undefined;
      if (p) setPrefs((cur) => ({ ...cur, ...p }));
    });
  }, []);
  const savePrefs = (next: Partial<Prefs>) =>
    setPrefs((cur) => {
      const merged = { ...cur, ...next };
      void browser.storage.local.set({ [PREFS_KEY]: merged });
      return merged;
    });

  // --- Drag-to-move (expanded panel) ---------------------------------------
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const pos = dragPos ?? prefs.pos; // live drag wins, else the persisted position

  // Re-clamp height/position against the viewport when the window resizes.
  const [, bumpLayout] = useState(0);
  useEffect(() => {
    const onResize = () => bumpLayout((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onDragStart = (e: ReactPointerEvent) => {
    // Don't start a drag from an interactive control inside the header.
    if ((e.target as HTMLElement).closest('button, select, input, a')) return;
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const move = (ev: PointerEvent) => {
      const x = Math.max(8, Math.min(ev.clientX - offX, window.innerWidth - w - 8));
      const y = Math.max(8, Math.min(ev.clientY - offY, window.innerHeight - h - 8));
      setDragPos({ x, y });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragPos((cur) => {
        if (cur) savePrefs({ pos: cur }); // persist where it landed
        return cur;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Height in px so we can keep the panel on-screen as it grows. Full = the
  // original height (top:64 → bottom:92 ⇒ 100vh - 156); half is the default.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const fullH = Math.max(220, vh - 156);
  const heightPx = Math.round(prefs.enlarged ? fullH : fullH / 2);
  // Position: default top-right anchor unless dragged. When dragged, clamp the
  // top so enlarging near the bottom fills the space ABOVE instead of spilling
  // off-screen (top is pinned so top + height stays within the viewport).
  const panelStyle: CSSProperties = { height: heightPx };
  if (pos) {
    panelStyle.left = pos.x;
    panelStyle.top = Math.max(8, Math.min(pos.y, vh - heightPx - 8));
    panelStyle.right = 'auto';
  }

  // Fetch lyrics whenever the track changes.
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
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Translate when enabled and lyrics are present (cache first).
  useEffect(() => {
    if (!track || !prefs.autoTranslate || lines.length === 0) return;
    let cancelled = false;
    (async () => {
      const cached = await getCachedTranslation(track.artist, track.title, prefs.targetLanguage);
      if (cancelled) return;
      if (cached && cached.length === lines.length) {
        setTranslated(cached);
        return;
      }
      setStatus('translating');
      const res = await requestTranslation({
        // Send the CODE (e.g. "en"), matching how the web app keys its cache — so
        // a song translated on the web is a free hit here.
        lines: lines.map((l) => l.text),
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
    return () => {
      cancelled = true;
    };
  }, [key, lines, prefs.autoTranslate, prefs.targetLanguage]);

  // A smooth, precise playback clock. We re-anchor {position, captured-at} ONLY
  // when the underlying reading changes value — so a coarse, once-per-second
  // source (the player bar, which we ride while the <video> clock is unreliable
  // after a track change) is anchored at its second-boundary tick rather than at
  // an arbitrary point mid-second, which is what left the whole next song lagging
  // by up to ~1s. Between anchors we dead-reckon with elapsed wall-clock time. The
  // <video> reading changes every poll, so a fresh play stays exact. A 100ms tick
  // drives the re-renders.
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

  // Collapsed → a single, unobtrusive launcher.
  if (!prefs.open) {
    return (
      <button
        className="melofy-fab"
        onClick={() => {
          savePrefs({ open: true });
          trackEvent('widget_opened');
        }}
        aria-label="Open Melofy lyrics"
      >
        <Glyph size={20} />
        {status === 'translating' && <span className="melofy-fab-dot" />}
      </button>
    );
  }

  return (
    <div className="melofy-panel" style={panelStyle} ref={panelRef} role="dialog" aria-label="Melofy lyrics">
      <header className="melofy-header" onPointerDown={onDragStart}>
        <div className="melofy-brand">
          <span className="melofy-brand-glyph"><Glyph size={15} /></span>
          Melofy
          {status === 'translating' && <span className="melofy-dot" title="Translating…" />}
        </div>
        <div className="melofy-header-actions">
          <button
            className="melofy-iconbtn"
            onClick={() => savePrefs({ enlarged: !prefs.enlarged })}
            aria-label={prefs.enlarged ? 'Shrink' : 'Enlarge'}
            title={prefs.enlarged ? 'Shrink' : 'Enlarge'}
          >
            <ResizeIcon enlarged={prefs.enlarged} />
          </button>
          <button className="melofy-iconbtn" onClick={() => { savePrefs({ open: false }); trackEvent('widget_collapsed'); }} aria-label="Minimize">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </header>

      {track ? (
        <div className="melofy-nowplaying">
          {track.albumArtUrl ? (
            <img className="melofy-art" src={track.albumArtUrl} alt="" />
          ) : (
            <span className="melofy-art melofy-art-fallback"><Glyph size={16} /></span>
          )}
          <div className="melofy-np-meta">
            <div className="melofy-np-title" title={track.title}>{track.title}</div>
            <div className="melofy-np-artist" title={track.artist}>{track.artist}</div>
          </div>
        </div>
      ) : (
        <div className="melofy-nowplaying melofy-muted">Nothing playing</div>
      )}

      <div className="melofy-controls">
        <button
          className={`melofy-switch${prefs.autoTranslate ? ' is-on' : ''}`}
          role="switch"
          aria-checked={prefs.autoTranslate}
          onClick={() => savePrefs({ autoTranslate: !prefs.autoTranslate })}
        >
          <span className="melofy-switch-label">Translate</span>
          <span className="melofy-switch-track"><span className="melofy-switch-thumb" /></span>
        </button>
        <div className="melofy-size" role="group" aria-label="Font size">
          {FONT_SIZES.map((s) => (
            <button
              key={s}
              className={`msz${prefs.fontSize === s ? ' is-active' : ''}`}
              data-sz={s}
              aria-pressed={prefs.fontSize === s}
              aria-label={`Font size ${s}`}
              onClick={() => savePrefs({ fontSize: s })}
            >
              A
            </button>
          ))}
        </div>
        <select className="melofy-select" value={prefs.targetLanguage} onChange={(e) => savePrefs({ targetLanguage: e.target.value })}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
      </div>

      <div className="melofy-lines" data-size={prefs.fontSize} ref={listRef}>
        {status === 'loading' && <div className="melofy-state">Loading lyrics…</div>}
        {status === 'error' && <div className="melofy-state melofy-error">{error}</div>}
        {status !== 'loading' &&
          lines.map((line, i) => {
            const isActive = i === activeIndex;
            const isPast = synced && i < activeIndex;
            const primary = showTranslation && translated ? translated[i] ?? line.text : line.text;
            const secondary = showTranslation && translated && translated[i] && translated[i] !== line.text ? line.text : null;
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

