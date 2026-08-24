'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { clearApiKey, hasApiKey, isRemembered, setApiKey } from '@/lib/byok/client';
import { track } from '@/lib/analytics/client';

// "Bring your own key" — paste a Google Gemini API key to translate with your own
// quota (and bypass the shared daily limit). The key is encrypted in transit
// (RSA-OAEP) and, if remembered, encrypted at rest (AES-GCM); it is never stored
// on Melofy's servers.
export function ByokModal({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(false);

  useEffect(() => {
    setExisting(hasApiKey());
    setRemember(isRemembered() || !hasApiKey());
    track('byok_modal_opened');
  }, []);

  const save = async () => {
    if (!key.trim()) return;
    setBusy(true);
    await setApiKey(key.trim(), remember);
    setBusy(false);
    track('byok_configured', { remembered: remember });
    onSaved?.();
    onClose();
  };

  const remove = () => {
    clearApiKey();
    setExisting(false);
    setKey('');
    track('byok_removed');
    onSaved?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1c1c1e] p-7 border border-gray-200 dark:border-white/10 shadow-2xl"
      >
        <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Use your own API key</h2>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-white/50 leading-relaxed">
          Paste your own API key to translate with your own quota and skip the shared daily limit — a{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-melofy-500 hover:underline"
          >
            free Google Gemini key
          </a>{' '}
          or an{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="text-melofy-500 hover:underline"
          >
            OpenRouter key
          </a>{' '}
          (more reliable).
        </p>

        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder={existing ? '•••••••••• (a key is already saved)' : 'AIza… or sk-or-…'}
          className="mt-5 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:border-melofy-500 dark:focus:border-melofy-400 transition-colors"
        />

        <label className="mt-3 flex items-center gap-2 text-sm text-gray-600 dark:text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="accent-melofy-500"
          />
          Remember on this device
          <span className="text-gray-400 dark:text-white/30">
            {remember ? '(encrypted locally)' : '(used only until you close the tab)'}
          </span>
        </label>

        <div className="mt-4 rounded-xl bg-gray-50 dark:bg-white/[0.03] p-3 text-[12px] leading-relaxed text-gray-500 dark:text-white/40">
          🔒 Your key is encrypted in transit and{' '}
          {remember ? 'encrypted at rest in this browser' : 'kept only in memory'}. It&rsquo;s used only to
          translate for you and is <span className="font-medium">never stored on Melofy&rsquo;s servers</span>.
        </div>

        <div className="mt-5 flex gap-3">
          {existing && (
            <button
              onClick={remove}
              className="rounded-2xl border border-gray-200 dark:border-white/10 px-4 py-3 text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.97] transition-all duration-200"
            >
              Remove
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-200 dark:border-white/10 px-4 py-3 text-sm font-medium text-gray-700 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.97] transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !key.trim()}
            className="flex-1 rounded-2xl bg-melofy-500 px-4 py-3 text-sm font-semibold text-white hover:bg-melofy-600 disabled:opacity-50 active:scale-[0.97] transition-all duration-200"
          >
            {busy ? 'Saving…' : 'Save key'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
