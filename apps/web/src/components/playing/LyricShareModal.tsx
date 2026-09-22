'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { renderShareCard, type ShareLine } from '@/lib/shareCard';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface Props {
  lines: ShareLine[];
  title: string;
  artist: string;
  albumArtUrl?: string;
  accent?: string;
  onClose: () => void;
}

export function LyricShareModal({ lines, title, artist, albumArtUrl, accent, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Whether to offer the OS share sheet at all. `navigator.canShare` is NOT
  // enough on its own: desktop Chrome and Safari on macOS both report true and
  // open a share sheet nobody wants there. Require a touch-class device too, so
  // laptops get "Save image" as the primary action instead.
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEscapeKey(true, onClose);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    renderShareCard({ lines, title, artist, albumArtUrl, accent })
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
        const probe = new File([b], 'melofy.png', { type: 'image/png' });
        const touchClass = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        setCanNativeShare(touchClass && !!navigator.canShare?.({ files: [probe] }));
      })
      .catch(() => !cancelled && setError("Couldn't build the image — you can still copy the text."));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [lines, title, artist, albumArtUrl, accent]);

  const fileName = `melofy-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)}.png`;
  const asText = `${lines.map((l) => (l.secondary ? `${l.primary}\n${l.secondary}` : l.primary)).join('\n')}\n\n— ${artist}, "${title}" · Melofy`;

  const share = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      // Image ONLY. Any `text`/`title` here becomes a caption on WhatsApp status
      // and similar targets, so the lyrics appeared twice — on the card and as
      // text beside it. The "Copy text" button is the explicit path for words.
      await navigator.share({ files: [file] });
      onClose();
    } catch {}
  };

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    // Firefox ignores a click on a detached anchor, so it has to be in the DOM.
    document.body.appendChild(a);
    a.click();
    a.remove();
    onClose();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Clipboard is blocked in this browser.');
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl border border-black/[0.06] dark:border-white/10 shadow-2xl p-5 pb-7"
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-black/10 dark:bg-white/15 sm:hidden" />

        <div className="aspect-square w-full overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5">
          {url ? (
            <img src={url} alt="Lyric card preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-white/40">
              {error ? 'Preview unavailable' : 'Building your card…'}
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">{error}</p>}

        <div className="mt-4 flex flex-col gap-2">
          {canNativeShare ? (
            <>
              <button
                onClick={share}
                disabled={!blob}
                className="w-full rounded-2xl bg-melofy-500 px-4 py-3 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
              >
                Share
              </button>
              <div className="flex gap-2">
                <button
                  onClick={download}
                  disabled={!url}
                  className="flex-1 rounded-2xl bg-black/[0.05] px-4 py-2.5 text-sm font-semibold text-gray-700 dark:bg-white/[0.08] dark:text-white/70 disabled:opacity-40"
                >
                  Save image
                </button>
                <button
                  onClick={copy}
                  className="flex-1 rounded-2xl bg-black/[0.05] px-4 py-2.5 text-sm font-semibold text-gray-700 dark:bg-white/[0.08] dark:text-white/70"
                >
                  {copied ? 'Copied' : 'Copy text'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={download}
                disabled={!url}
                className="w-full rounded-2xl bg-melofy-500 px-4 py-3 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
              >
                Save image
              </button>
              <button
                onClick={copy}
                className="w-full rounded-2xl bg-black/[0.05] px-4 py-2.5 text-sm font-semibold text-gray-700 dark:bg-white/[0.08] dark:text-white/70"
              >
                {copied ? 'Copied' : 'Copy text'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
