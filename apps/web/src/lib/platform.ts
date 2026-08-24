// Best-effort check for whether this device can install the Melofy browser
// extension (desktop Chromium/Firefox). Mobile browsers effectively can't, so we
// hide YouTube Music there (it depends on the extension as its now-playing
// provider). Heuristic — not exhaustive, but right for the common cases.
export function canUseExtension(): boolean {
  if (typeof navigator === 'undefined') return true; // SSR: assume yes, corrected on the client
  const uaData = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData && typeof uaData.mobile === 'boolean') return !uaData.mobile;
  return !/Android|iPhone|iPad|iPod|Mobile|Windows Phone|webOS/i.test(navigator.userAgent);
}

/** Fallback album art used when a track has no cover. */
export const DEFAULT_COVER = '/melofy-bg.webp';
