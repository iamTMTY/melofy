// ponytail: hand-drawn on a 2D canvas rather than pulling in html2canvas —
// it's one square layout, and a DOM rasterizer is ~200KB for the privilege.
// If the card ever needs real layout (RTL, mixed scripts, rich text), swap the
// body of renderShareCard for a rasterizer; the signature stays.

export const MAX_SHARE_LINES = 5;

export function toggleShareSelection(cur: number[], idx: number, max = MAX_SHARE_LINES): number[] {
  if (cur.includes(idx)) {
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

/** Wordmark cap height as a fraction of the mark's height. Raise to enlarge. */
const CAP_RATIO = 0.88;
/** How far to lift the wordmark off the bars' baseline, as a fraction of the mark. */
const BASELINE_LIFT = 0.14;

const LEADING = 1.14;
const SUB_LEADING = 1.25;
const ENTRY_GAP = 0.62;

export interface ShareLine {
  primary: string;
  secondary?: string | null;
}

export interface ShareCardInput {
  lines: ShareLine[];
  title: string;
  artist: string;
  albumArtUrl?: string;
  accent?: string;
}

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

const BRAND = '#c4b5fd';

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

async function ensureFonts(specs: string[]): Promise<void> {
  try {
    if (!document.fonts) return;
    await Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => {})));
    await document.fonts.ready;
  } catch {}
}

/**
 * Cover-fit `img` into a `size`² square and blur it by roughly `strength` px.
 *
 * Deliberately NOT `ctx.filter = 'blur(…)'`: mobile WebKit ignores that property
 * silently, so phones drew the cover sharp under the scrim and the card looked
 * broken. Repeated halving then doubling with bilinear resampling is supported
 * everywhere and converges on a gaussian-like blur; the intermediate hops are
 * what keep it smooth (a single 30× upscale would show pyramid artefacts).
 */
function blurredCover(img: HTMLImageElement, size: number, strength: number): HTMLCanvasElement {
  const make = (w: number) => {
    const c = document.createElement('canvas');
    c.width = c.height = w;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    return { c, g };
  };

  let { c: cur, g } = make(size);
  const scale = Math.max(size / img.width, size / img.height) * 1.25;
  g.drawImage(img, (size - img.width * scale) / 2, (size - img.height * scale) / 2, img.width * scale, img.height * scale);

  const target = Math.max(6, Math.round(size / strength));
  let w = size;
  while (w / 2 >= target) {
    const next = make(w / 2);
    next.g.drawImage(cur, 0, 0, w / 2, w / 2);
    cur = next.c;
    w /= 2;
  }
  while (w < size) {
    const nw = Math.min(size, w * 2);
    const next = make(nw);
    next.g.drawImage(cur, 0, 0, nw, nw);
    cur = next.c;
    w = nw;
  }
  return cur;
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

  if (art) {
    // ponytail: 80 is calibrated, not literal. The blur only changes at each
    // halving, so at 1080px `48` stops at a 33px intermediate (too sharp — the
    // cover stays legible) while `80` reaches 16px, which matches the player's
    // backdrop-blur-3xl (64px). Re-tune if SIZE changes.
    ctx.drawImage(blurredCover(art, SIZE, 80), 0, 0);
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

  const bodyTop = PAD + thumb + 70;
  const bodyBottom = SIZE - PAD - 90;
  const maxWidth = SIZE - PAD * 2;

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
      if (prevSub) y += fontSize * ENTRY_GAP;
      y += fontSize * LEADING;
    }
    ctx.fillText(block.text, PAD, y);
    prevSub = block.sub;
  }

  const markH = 46;
  const markW = drawMark(ctx, PAD, SIZE - PAD - markH, markH);
  ctx.fillStyle = BRAND;

  const WORDMARK = 'Melofy';
  const targetAscent = markH * CAP_RATIO;
  ctx.font = `400 100px ${brand}`;
  const probe = ctx.measureText(WORDMARK).actualBoundingBoxAscent;
  const size = probe > 0 ? Math.round((100 * targetAscent) / probe) : Math.round(targetAscent * 1.4);

  ctx.font = `400 ${size}px ${brand}`;
  ctx.fillText(WORDMARK, PAD + markW + 20, SIZE - PAD - markH * BASELINE_LIFT);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not render the card'))), 'image/png');
  });
}
