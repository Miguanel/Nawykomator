import * as db from '../db/db';
import type { MediaItem, MediaKind } from '../db/types';
import { uid } from './util';

export function youtubeId(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/) ??
    url.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}

export function spotifyEmbed(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}

export function detectKind(url: string): MediaKind {
  if (youtubeId(url) && /youtu/.test(url)) return 'youtube';
  if (/soundcloud\.com\//.test(url)) return 'soundcloud';
  if (/open\.spotify\.com\//.test(url)) return 'spotify';
  return 'url';
}

export function isDirectMediaUrl(url: string): 'audio' | 'video' | null {
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba)$/.test(clean)) return 'audio';
  if (/\.(mp4|webm|mov|m4v|ogv|mkv)$/.test(clean)) return 'video';
  return null;
}

export function defaultTitle(url: string, kind: MediaKind): string {
  if (kind === 'youtube') return `YouTube ${youtubeId(url) ?? ''}`.trim();
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '');
    return last || u.hostname;
  } catch {
    return url;
  }
}

export async function createLinkMedia(url: string, title?: string): Promise<MediaItem> {
  const kind = detectKind(url.trim());
  const item: MediaItem = {
    id: uid(),
    kind,
    url: url.trim(),
    title: title?.trim() || defaultTitle(url.trim(), kind),
    createdAt: Date.now(),
  };
  await db.put('media', item);
  return item;
}

export async function createBlobMedia(blob: Blob, kind: MediaKind, title: string): Promise<MediaItem> {
  const blobId = uid();
  await db.put('blobs', { id: blobId, blob });
  const item: MediaItem = { id: uid(), kind, blobId, mime: blob.type, title, createdAt: Date.now() };
  await db.put('media', item);
  return item;
}

export async function deleteMedia(id: string): Promise<void> {
  const m = await db.get('media', id);
  if (m?.blobId) await db.del('blobs', m.blobId);
  await db.del('media', id);
}

// cache object URL-i, żeby nie tworzyć ich przy każdym renderze
const urlCache = new Map<string, string>();
export async function blobUrl(blobId: string): Promise<string | null> {
  const cached = urlCache.get(blobId);
  if (cached) return cached;
  const row = await db.get('blobs', blobId);
  if (!row) return null;
  const url = URL.createObjectURL(row.blob);
  urlCache.set(blobId, url);
  return url;
}

export function mediaIsVideo(m: MediaItem): boolean {
  if (m.kind === 'youtube') return true;
  if (m.mime) return m.mime.startsWith('video/');
  if (m.url) return isDirectMediaUrl(m.url) === 'video';
  return false;
}

export const KIND_ICON: Record<MediaKind, string> = {
  youtube: '▶️',
  soundcloud: '☁️',
  spotify: '🎵',
  url: '🔗',
  file: '📁',
  voice: '🎙️',
  image: '🖼️',
};
