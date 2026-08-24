'use client';

import { useState } from 'react';
import { clearTranslationCache } from '@/lib/cache/translationCache';

// Wipes the browser-local (IndexedDB) translation cache. The server-side
// Redis/Mongo cache is unaffected. Renders just a button so it can sit inline.
export function ClearCacheButton({ className }: { className?: string }) {
  const [state, setState] = useState<'idle' | 'clearing' | 'cleared'>('idle');

  const onClick = async () => {
    setState('clearing');
    await clearTranslationCache();
    setState('cleared');
    setTimeout(() => setState('idle'), 2000);
  };

  return (
    <button
      onClick={onClick}
      disabled={state !== 'idle'}
      className={
        className ??
        'text-gray-400 transition-colors duration-200 hover:text-gray-600 disabled:opacity-60 dark:text-white/30 dark:hover:text-white/50'
      }
    >
      {state === 'cleared' ? 'Cached lyrics cleared' : state === 'clearing' ? 'Clearing…' : 'Clear cached lyrics'}
    </button>
  );
}
