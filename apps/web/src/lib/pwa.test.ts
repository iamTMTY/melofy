import { describe, it, expect } from 'vitest';
import { INSTALL_DISMISS_FOR_MS, afterUserChoice, isInstallDismissed, resolveInstallMode } from './pwa';

const DAY = 24 * 60 * 60 * 1000;
const base = { standalone: false, dismissed: false, hasNativePrompt: false, ios: false };

describe('resolveInstallMode', () => {
  it('shows nothing when already installed, regardless of platform', () => {
    expect(resolveInstallMode({ ...base, standalone: true, hasNativePrompt: true })).toBe('hidden');
    expect(resolveInstallMode({ ...base, standalone: true, ios: true })).toBe('hidden');
  });

  it('shows nothing during the dismissal quiet period', () => {
    expect(resolveInstallMode({ ...base, dismissed: true, hasNativePrompt: true })).toBe('hidden');
    expect(resolveInstallMode({ ...base, dismissed: true, ios: true })).toBe('hidden');
  });

  it('uses the native prompt when the browser offers one', () => {
    expect(resolveInstallMode({ ...base, hasNativePrompt: true })).toBe('native');
  });

  it('native wins over the iOS hint if both somehow apply', () => {
    expect(resolveInstallMode({ ...base, hasNativePrompt: true, ios: true })).toBe('native');
  });

  it('falls back to the manual hint on iOS, which never fires the event', () => {
    expect(resolveInstallMode({ ...base, ios: true })).toBe('ios');
  });

  it('shows nothing on a browser with no install path at all', () => {
    expect(resolveInstallMode(base)).toBe('hidden');
  });
});

describe('isInstallDismissed', () => {
  const now = 1_800_000_000_000;
  it('is dismissed just after dismissing and just before expiry', () => {
    expect(isInstallDismissed(String(now - 1000), now)).toBe(true);
    expect(isInstallDismissed(String(now - (INSTALL_DISMISS_FOR_MS - 1)), now)).toBe(true);
  });
  it('expires after the quiet period', () => {
    expect(isInstallDismissed(String(now - INSTALL_DISMISS_FOR_MS), now)).toBe(false);
    expect(isInstallDismissed(String(now - 15 * DAY), now)).toBe(false);
  });
  it('treats missing or garbage storage as not dismissed', () => {
    expect(isInstallDismissed(null, now)).toBe(false);
    expect(isInstallDismissed(undefined, now)).toBe(false);
    expect(isInstallDismissed('', now)).toBe(false);
    expect(isInstallDismissed('not-a-number', now)).toBe(false);
    expect(isInstallDismissed('0', now)).toBe(false);
  });
});

describe('afterUserChoice', () => {
  it('hides for good on accept, persists a dismissal otherwise', () => {
    expect(afterUserChoice('accepted')).toBe('installed');
    expect(afterUserChoice('dismissed')).toBe('dismissed');
    expect(afterUserChoice('')).toBe('dismissed');
  });
});
