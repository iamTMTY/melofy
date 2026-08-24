import { useEffect, useState } from 'react';
import type { NowPlaying } from '@melofy/core';
import { NOW_PLAYING_KEY } from '../../lib/nowplaying';
import { ENABLED_KEY } from '../../lib/config';
import { clearStoredKey, getStoredKey, setStoredKey } from '../../lib/byok';
import { track } from '../../lib/analytics';

export function App() {
  const [np, setNp] = useState<NowPlaying | null>(null);
  const [settings, setSettings] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    track('popup_opened');
    browser.storage.local.get([NOW_PLAYING_KEY, ENABLED_KEY]).then((r) => {
      setNp((r[NOW_PLAYING_KEY] as NowPlaying) ?? null);
      setEnabled((r[ENABLED_KEY] as boolean | undefined) ?? true);
    });
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local') return;
      if (changes[NOW_PLAYING_KEY]) setNp((changes[NOW_PLAYING_KEY].newValue as NowPlaying) ?? null);
      if (changes[ENABLED_KEY]) setEnabled((changes[ENABLED_KEY].newValue as boolean | undefined) ?? true);
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    void browser.storage.local.set({ [ENABLED_KEY]: next });
    track(next ? 'widget_enabled' : 'widget_disabled');
  };

  return (
    <div className="w-80 bg-neutral-950 p-4 font-sans text-neutral-100">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg font-semibold">Melofy</span>
        <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">extension</span>
        <button
          onClick={() => setSettings((v) => !v)}
          aria-label="Settings"
          aria-pressed={settings}
          className={`ml-auto flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            settings ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-100'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {settings ? (
        <ByokSettings />
      ) : (
        <>
          {/* Master on/off — unmounts the on-page widget from YouTube Music. */}
          <div className="mb-3 flex items-center justify-between rounded-xl bg-neutral-900 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Lyrics widget</p>
              <p className="text-[11px] text-neutral-500">
                {enabled ? 'Showing on YouTube Music' : 'Hidden — turn on to show'}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={enabled}
              aria-label="Toggle lyrics widget"
              onClick={toggleEnabled}
              className={`relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full border-0 p-0 transition-colors ${
                enabled ? 'bg-violet-600' : 'bg-neutral-700'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {np ? (
            <div className="flex items-center gap-3">
              {np.track.albumArtUrl ? (
                <img src={np.track.albumArtUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-neutral-800" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{np.track.title}</p>
                <p className="truncate text-xs text-neutral-400">{np.track.artist}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {np.isPlaying ? '▶ playing' : '⏸ paused'} · {Math.floor(np.positionMs / 1000)}s
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">
              Open <span className="text-neutral-200">music.youtube.com</span> and play a song — it&rsquo;ll show
              up here.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ByokSettings() {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStoredKey().then((k) => setSaved(!!k));
  }, []);

  const save = async () => {
    if (!key.trim()) return;
    setBusy(true);
    await setStoredKey(key.trim());
    setBusy(false);
    setSaved(true);
    setKey('');
    track('byok_configured', { surface_detail: 'popup' });
  };
  const remove = async () => {
    await clearStoredKey();
    setSaved(false);
    setKey('');
    track('byok_removed', { surface_detail: 'popup' });
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-neutral-100">Your API key</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
        Add your own key to translate with your own quota and skip the daily limit — a{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
          free Gemini key
        </a>{' '}
        or an{' '}
        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
          OpenRouter key
        </a>
        .
      </p>

      {saved && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> A key is saved on this device.
        </div>
      )}

      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder={saved ? 'Enter a new key to replace' : 'AIza… or sk-or-…'}
        className="mt-3 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500"
      />

      <div className="mt-3 rounded-lg bg-neutral-900 p-2.5 text-[11px] leading-relaxed text-neutral-500">
        🔒 Sent encrypted, used only for your translations, and never stored on Melofy&rsquo;s servers. Kept in
        this browser&rsquo;s extension storage.
      </div>

      <div className="mt-3 flex gap-2">
        {saved && (
          <button
            onClick={remove}
            className="rounded-lg border border-neutral-800 px-3 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-900"
          >
            Remove
          </button>
        )}
        <button
          onClick={save}
          disabled={busy || !key.trim()}
          className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save key'}
        </button>
      </div>
    </div>
  );
}
