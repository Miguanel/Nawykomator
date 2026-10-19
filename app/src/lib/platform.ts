import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export const isNative = () => Capacitor.isNativePlatform();

/** Otwiera link poza apką (przeglądarka systemowa / aplikacja Spotify itp.) */
export async function openExternal(url: string): Promise<void> {
  if (isNative()) {
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

/** Trzymaj ekran włączony podczas wykonywania zadania (jeśli WebView to wspiera). */
let wakeLock: { release: () => Promise<void> } | null = null;
export async function keepAwake(on: boolean): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (on && nav.wakeLock && !wakeLock) wakeLock = await nav.wakeLock.request('screen');
    if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* brak wsparcia – trudno */
  }
}
