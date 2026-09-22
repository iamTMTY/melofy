export type InstallMode = 'hidden' | 'native' | 'ios';

export const INSTALL_DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

export function isInstallDismissed(dismissedAtRaw: string | null | undefined, now: number): boolean {
  const at = Number(dismissedAtRaw || 0);
  if (!Number.isFinite(at) || at <= 0) return false;
  return now - at < INSTALL_DISMISS_FOR_MS;
}

export interface InstallContext {
  standalone: boolean;
  dismissed: boolean;
  hasNativePrompt: boolean;
  ios: boolean;
}

export function resolveInstallMode(ctx: InstallContext): InstallMode {
  if (ctx.standalone || ctx.dismissed) return 'hidden';
  if (ctx.hasNativePrompt) return 'native';
  if (ctx.ios) return 'ios';
  return 'hidden';
}

export function afterUserChoice(outcome: string): 'installed' | 'dismissed' {
  return outcome === 'accepted' ? 'installed' : 'dismissed';
}
