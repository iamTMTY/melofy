'use client';

import { useEffect, useState } from 'react';

const FALLBACK = '#c4b5fd';

function readableTint(r: number, g: number, b: number): string {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const sat = Math.round(Math.min(Math.max(s, 0.45), 0.8) * 100);
  return `hsl(${Math.round(h)}, ${sat}%, 80%)`;
}

/**
 * Samples the album art and returns a vivid accent colour from it.
 *
 * ponytail: 12x12 downscale + pick the most vivid pixel. Good enough for a
 * highlight tint; swap in a proper k-means palette only if the colours read
 * muddy on real artwork.
 */
export function useAdaptiveAccent(imageUrl: string | undefined, enabled: boolean): string {
  const [accent, setAccent] = useState(FALLBACK);

  useEffect(() => {
    if (!enabled || !imageUrl) {
      setAccent(FALLBACK);
      return;
    }

    let cancelled = false;
    const img = new Image();
    // Album CDNs serve CORS headers; without this the canvas is tainted and
    // getImageData throws — which the catch below turns into the fallback.
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const n = 12;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = n;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, n, n);
        const { data } = ctx.getImageData(0, 0, n, n);

        let best = FALLBACK;
        let bestScore = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const lightness = (max + min) / 2 / 255;
          if (lightness < 0.2 || lightness > 0.85) continue;
          const score = (max - min) * lightness;
          if (score > bestScore) {
            bestScore = score;
            best = readableTint(r, g, b);
          }
        }
        setAccent(best);
      } catch {
        setAccent(FALLBACK);
      }
    };
    img.onerror = () => !cancelled && setAccent(FALLBACK);
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl, enabled]);

  return accent;
}
