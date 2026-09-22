/**
 * Install-prompt decision logic, kept free of React and the DOM so the state
 * transitions can be unit-tested. components/pwa/InstallPrompt.tsx is the thin
 * browser-event wrapper around these.
 */
export type InstallMode = 'hidden' | 'native' | 'ios';

/** How long a dismissal hides the prompt. */
export const INSTALL_DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

/** True while a stored dismissal timestamp is still within the quiet period. */
export function isInstallDismissed(dismissedAtRaw: string | null | undefined, now: number): boolean {
  const at = Number(dismissedAtRaw || 0);
  if (!Number.isFinite(at) || at <= 0) return false;
  return now - at < INSTALL_DISMISS_FOR_MS;
}

export interface InstallContext {
  /** Already running as an installed app (display-mode: standalone). */
  standalone: boolean;
  /** Dismissed within INSTALL_DISMISS_FOR_MS. */
  dismissed: boolean;
  /** A `beforeinstallprompt` event is available to call .prompt() on. */
  hasNativePrompt: boolean;
  /** iOS Safari — no install API exists; only the manual hint applies. */
  ios: boolean;
}

/**
 * Which prompt to show. Native wins over the iOS hint: if a real install event
 * exists, use it. Nothing is shown when already installed or recently dismissed.
 */
export function resolveInstallMode(ctx: InstallContext): InstallMode {
  if (ctx.standalone || ctx.dismissed) return 'hidden';
  if (ctx.hasNativePrompt) return 'native';
  if (ctx.ios) return 'ios';
  return 'hidden';
}

/** Outcome of the native prompt → what the UI should do next. */
export function afterUserChoice(outcome: string): 'installed' | 'dismissed' {
  return outcome === 'accepted' ? 'installed' : 'dismissed';
}
