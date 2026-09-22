export function canUseExtension(): boolean {
  if (typeof navigator === 'undefined') return true;
  const uaData = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData && typeof uaData.mobile === 'boolean') return !uaData.mobile;
  return !/Android|iPhone|iPad|iPod|Mobile|Windows Phone|webOS/i.test(navigator.userAgent);
}

export const DEFAULT_COVER = '/melofy-bg.webp';
