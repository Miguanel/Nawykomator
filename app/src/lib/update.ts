import { APP_VERSION, SITE_URL } from '../config';
import { isNative } from './platform';
import { cmpVersion } from './util';

export interface UpdateInfo {
  version: string;
  apk: string;
  notes?: string;
}

/** Sprawdza `${SITE_URL}/version.json`. Zwraca info tylko, gdy jest nowsza wersja. */
export async function checkForUpdate(force = false): Promise<UpdateInfo | null> {
  if (!isNative() && !force) return null;
  try {
    const res = await fetch(`${SITE_URL}/version.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const info = (await res.json()) as UpdateInfo;
    if (!info.version || cmpVersion(info.version, APP_VERSION) <= 0) return null;
    if (info.apk && !/^https?:/.test(info.apk)) info.apk = `${SITE_URL}/${info.apk.replace(/^\//, '')}`;
    return info;
  } catch {
    return null;
  }
}
