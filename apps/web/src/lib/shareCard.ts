// Renders a shareable lyric card to a PNG blob.
//
// ponytail: hand-drawn on a 2D canvas rather than pulling in html2canvas —
// it's one square layout, and a DOM rasterizer is ~200KB for the privilege.
// If the card ever needs real layout (RTL, mixed scripts, rich text), swap the
// body of renderShareCard for a rasterizer; the signature stays.

/** Most platforms cap a shared snippet at a handful of lines; so do we. */
export const MAX_SHARE_LINES = 5;

/**
 * Toggles a lyric index in the share selection, keeping it a contiguous run:
 * tapping an end drops it, tapping a neighbour extends, anything else starts
 * a fresh selection. Returns a sorted array.
 */
export function toggleShareSelection(cur: number[], idx: number, max = MAX_SHARE_LINES): number[] {
  if (cur.includes(idx)) {
    // Removing from the middle would split the run, so only the ends give.
    if (idx === cur[0] || idx === cur[cur.length - 1]) return cur.filter((i) => i !== idx);
    return cur;
  }
  if (cur.length === 0) return [idx];
  if (cur.length >= max) return cur;
  if (idx === cur[0] - 1) return [idx, ...cur];
  if (idx === cur[cur.length - 1] + 1) return [...cur, idx];
  return [idx];
}

const SIZE = 1080;
const PAD = 80;
const BARS = [34, 29, 24, 19, 14, 19, 24, 29, 34];

// Rhythm: wrapped rows of the SAME lyric hug each other, the gloss sits close
// under its line, and the visible break lands between separate lyric lines.
/** Wordmark cap height as a fraction of the mark's height. Raise to enlarge. */
const CAP_RATIO = 0.88;
/** How far to lift the wordmark off the bars' baseline, as a fraction of the mark. */
const BASELINE_LIFT = 0.14;

const LEADING = 1.14;
const SUB_LEADING = 1.25;
const ENTRY_GAP = 0.62;

/** One lyric line: the text being read, plus the original when it's shown. */
export interface ShareLine {
  primary: string;
  secondary?: string | null;
}

export interface ShareCardInput {
  lines: ShareLine[];
  title: string;
  artist: string;
  albumArtUrl?: string;
  /** Accent used for the gradient when there's no usable artwork. */
  accent?: string;
}

/** Loads an image for canvas use, or null if it isn't CORS-readable. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Without a successful CORS load the canvas would taint and toBlob() would
    // throw — an onerror here is the clean "no artwork" path instead.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Greedy word wrap against the current ctx font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const out: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      out.push(line);
      line = word;
    }
  }
  out.push(line);
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the Melofy waveform mark, scaled to `h` pixels tall. Returns its width. */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): number {
  const unit = h / Math.max(...BARS);
  const w = 3 * unit;
  const gap = 3 * unit;
  ctx.fillStyle = BRAND;
  BARS.forEach((bar, i) => {
    const bh = bar * unit;
    roundRect(ctx, x + i * (w + gap), y + (h - bh), w, bh, w / 2);
    ctx.fill();
  });
  return BARS.length * w + (BARS.length - 1) * gap;
}

/** melofy-200 — the wordmark colour the homepage uses on dark. */
const BRAND = '#c4b5fd';

/**
 * The app's own faces, read off the document so the card matches the UI:
 * Outfit for text, Bunch Blossoms for the wordmark. Falls back to system
 * fonts when the CSS vars aren't resolvable (SSR, tests).
 */
function fontStacks() {
  const read = (v: string) => {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    } catch {
      return '';
    }
  };
  const system = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const outfit = read('--font-outfit');
  const brandFace = read('--font-brand');
  return {
    sans: outfit ? `${outfit}, ${system}` : system,
    brand: brandFace ? `${brandFace}, cursive` : (outfit ? `${outfit}, ${system}` : system),
  };
}

/** Forces the given font shorthands to load; never throws. */
async function ensureFonts(specs: string[]): Promise<void> {
  try {
    if (!document.fonts) return;
    await Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => {})));
    await document.fonts.ready;
  } catch {
    // A missing face just means the system fallback renders — not fatal.
  }
}

export async function renderShareCard({ lines, title, artist, albumArtUrl, accent }: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const { sans, brand } = fontStacks();
  // Canvas silently falls back to a default face for a font the document hasn't
  // actually fetched — and the brand face isn't used anywhere on /playing, so
  // waiting on fonts.ready alone isn't enough. Request both explicitly.
  await ensureFonts([`700 62px ${sans}`, `400 46px ${brand}`]);

  const art = albumArtUrl ? await loadImage(albumArtUrl) : null;

  // --- background ---------------------------------------------------------
  if (art) {
    // Blurred cover fill, the way the player looks.
    ctx.save();
    ctx.filter = 'blur(48px) saturate(160%)';
    const scale = Math.max(SIZE / art.width, SIZE / art.height) * 1.25;
    const dw = art.width * scale;
    const dh = art.height * scale;
    ctx.drawImage(art, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
    ctx.restore();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fillRect(0, 0, SIZE, SIZE);
  } else {
    const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    g.addColorStop(0, accent || '#7c3aed');
    g.addColorStop(1, '#18181b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // --- header: cover thumb + track ----------------------------------------
  const thumb = 132;
  let textX = PAD;
  if (art) {
    ctx.save();
    roundRect(ctx, PAD, PAD, thumb, thumb, 24);
    ctx.clip();
    const s = Math.max(thumb / art.width, thumb / art.height);
    ctx.drawImage(art, PAD + (thumb - art.width * s) / 2, PAD + (thumb - art.height * s) / 2, art.width * s, art.height * s);
    ctx.restore();
    textX = PAD + thumb + 28;
  }

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 40px ${sans}`;
  const headWidth = SIZE - PAD - textX;
  ctx.fillText(wrap(ctx, title, headWidth)[0], textX, PAD + (art ? 58 : 44));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
  ctx.font = `500 34px ${sans}`;
  ctx.fillText(wrap(ctx, artist, headWidth)[0], textX, PAD + (art ? 108 : 94));

  // --- lyrics, vertically centred in the remaining space ------------------
  const bodyTop = PAD + thumb + 70;
  const bodyBottom = SIZE - PAD - 90;
  const maxWidth = SIZE - PAD * 2;

  // Each entry becomes a block: the read line, then the original beneath it.
  // Shrink the type until the whole selection fits — a 5-line snippet of long
  // lines would otherwise run off the bottom.
  type Block = { text: string; sub: boolean };
  let fontSize = 62;
  let blocks: Block[] = [];
  let height = 0;
  while (fontSize >= 30) {
    const subSize = Math.round(fontSize * 0.52);
    blocks = [];
    height = 0;
    for (const line of lines) {
      ctx.font = `700 ${fontSize}px ${sans}`;
      for (const w of wrap(ctx, line.primary, maxWidth)) {
        blocks.push({ text: w, sub: false });
        height += fontSize * LEADING;
      }
      if (line.secondary) {
        ctx.font = `500 ${subSize}px ${sans}`;
        for (const w of wrap(ctx, line.secondary, maxWidth)) {
          blocks.push({ text: w, sub: true });
          height += subSize * SUB_LEADING;
        }
      }
      height += fontSize * ENTRY_GAP;
    }
    if (height <= bodyBottom - bodyTop) break;
    fontSize -= 4;
  }

  const subSize = Math.round(fontSize * 0.52);
  let y = bodyTop + Math.max(0, (bodyBottom - bodyTop - height) / 2);
  let prevSub = false;
  for (const block of blocks) {
    if (block.sub) {
      ctx.font = `500 ${subSize}px ${sans}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      y += subSize * SUB_LEADING;
    } else {
      ctx.font = `700 ${fontSize}px ${sans}`;
      ctx.fillStyle = '#ffffff';
      // Breathing room when a new selected line starts after a gloss.
      if (prevSub) y += fontSize * ENTRY_GAP;
      y += fontSize * LEADING;
    }
    ctx.fillText(block.text, PAD, y);
    prevSub = block.sub;
  }

  // --- footer: mark + wordmark as ONE lockup, matching the homepage --------
  const markH = 46;
  const markW = drawMark(ctx, PAD, SIZE - PAD - markH, markH);
  ctx.fillStyle = BRAND;

  // Fit the wordmark by its ASCENT, not its full glyph box. Scaling the whole
  // box (which includes the 'y' tail) shrinks the letters themselves; matching
  // cap height to bar height and sharing a baseline is the standard lockup, and
  // the descender is allowed to hang below the bars as a tail.
  const WORDMARK = 'Melofy';
  const targetAscent = markH * CAP_RATIO;
  ctx.font = `400 100px ${brand}`;
  const probe = ctx.measureText(WORDMARK).actualBoundingBoxAscent;
  const size = probe > 0 ? Math.round((100 * targetAscent) / probe) : Math.round(targetAscent * 1.4);

  ctx.font = `400 ${size}px ${brand}`;
  // Sitting the baseline exactly on the bars' bottom reads as slightly LOW,
  // because the descending tail hangs below it and drags the optical centre
  // down. Lift it to put the visual mass on the mark's centre line.
  ctx.fillText(WORDMARK, PAD + markW + 20, SIZE - PAD - markH * BASELINE_LIFT);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not render the card'))), 'image/png');
  });
}
