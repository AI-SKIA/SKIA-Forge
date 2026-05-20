export const MOBILE_APP_APPROVED = false; // sync with Skia-FULL when stores approve

export type SkiaPlatform = 'web-browser' | 'mobile-browser' | 'forge-web' | 'forge-ide';

function isMobileUA(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|Windows Phone/i.test(navigator.userAgent);
}

export function getCurrentPlatform(): SkiaPlatform {
  if (typeof window === 'undefined') return 'forge-web';
  const injected = (window as Window & { __SKIA_PLATFORM__?: string }).__SKIA_PLATFORM__;
  if (injected === 'forge-ide' || injected === 'mobile-browser' || injected === 'forge-web' || injected === 'web-browser') {
    return injected as SkiaPlatform;
  }
  return isMobileUA() ? 'mobile-browser' : 'forge-web';
}

export function isMobileSurface(): boolean {
  return getCurrentPlatform() === 'mobile-browser';
}

export function isDesktopSurface(): boolean {
  const p = getCurrentPlatform();
  return p === 'forge-web' || p === 'forge-ide';
}

/** Forge web UI (forge.skia.ca) — desktop browser only; hidden in IDE and mobile browser. */
export function showForgeDownload(): boolean {
  return getCurrentPlatform() === 'forge-web';
}

export function showPCAppDownload(): boolean {
  return false;
}

export function showMobileAppDownload(): boolean {
  if (isMobileSurface()) return MOBILE_APP_APPROVED;
  return true;
}
