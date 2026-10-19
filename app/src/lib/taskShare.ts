// Udostępnianie i import zadań.
// Plik zadania (.json) zawiera kroki, linki, notatki i – jeśli nie są za duże – nagrania z telefonu.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SITE_URL } from '../config';
import * as db from '../db/db';
import type { MediaItem, Note, Task } from '../db/types';
import { t } from '../i18n';
import { requestReschedule } from './notifications';
import { isNative } from './platform';
import { scheduleSummary } from './scheduleText';
import { uid } from './util';

const FORMAT = 'nawykomator-task';
/** Limit nagrań dołączanych do pliku (base64 powiększa je o ~1/3). */
const MAX_BLOB_BYTES = 12 * 1024 * 1024;

interface PackedMedia extends MediaItem {
  data?: string; // base64
}

export interface TaskPackage {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  task: Task;
  media: PackedMedia[];
  notes: Note[];
  blobsSkipped?: boolean;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(data: string, mime = 'application/octet-stream'): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function packTask(task: Task): Promise<TaskPackage> {
  const noteIds = new Set(task.steps.map((s) => s.noteId).filter(Boolean) as string[]);
  const notes = (await Promise.all([...noteIds].map((id) => db.get('notes', id)))).filter(Boolean) as Note[];
  const mediaIds = new Set<string>();
  task.steps.forEach((s) => s.mediaId && mediaIds.add(s.mediaId));
  notes.forEach((n) => n.blocks.forEach((b) => b.mediaId && mediaIds.add(b.mediaId)));

  const media: PackedMedia[] = [];
  let total = 0;
  let skipped = false;
  for (const id of mediaIds) {
    const m = await db.get('media', id);
    if (!m) continue;
    const packed: PackedMedia = { ...m };
    if (m.blobId) {
      const row = await db.get('blobs', m.blobId);
      if (row && total + row.blob.size <= MAX_BLOB_BYTES) {
        packed.data = await blobToBase64(row.blob);
        total += row.blob.size;
      } else {
        skipped = true;
      }
      delete packed.blobId;
    }
    media.push(packed);
  }
  return {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    task: { ...task, archived: false },
    media,
    notes,
    blobsSkipped: skipped || undefined,
  };
}

/** Import z pliku: wszystko dostaje nowe id, więc można importować ten sam plik wiele razy. */
export async function importPackage(raw: unknown): Promise<Task> {
  const pkg = raw as TaskPackage;
  if (!pkg || pkg.format !== FORMAT || !pkg.task || !Array.isArray(pkg.task.steps)) throw new Error('format');

  const mediaMap = new Map<string, string>();
  for (const m of pkg.media ?? []) {
    const id = uid();
    mediaMap.set(m.id, id);
    const { data, ...rest } = m;
    const item: MediaItem = { ...rest, id, createdAt: Date.now() };
    if (data) {
      const blobId = uid();
      await db.put('blobs', { id: blobId, blob: base64ToBlob(data, m.mime) });
      item.blobId = blobId;
    }
    // plik z telefonu bez danych (za duży) – zostawiamy wpis, odtwarzacz pokaże "brak pliku"
    await db.put('media', item);
  }

  const noteMap = new Map<string, string>();
  for (const n of pkg.notes ?? []) {
    const id = uid();
    noteMap.set(n.id, id);
    await db.put('notes', {
      ...n,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blocks: n.blocks.map((b) => ({ ...b, id: uid(), mediaId: b.mediaId ? mediaMap.get(b.mediaId) : undefined })),
    });
  }

  const task: Task = {
    ...pkg.task,
    id: uid(),
    archived: false,
    createdAt: Date.now(),
    steps: pkg.task.steps.map((s) => ({
      ...s,
      id: uid(),
      mediaId: s.mediaId ? mediaMap.get(s.mediaId) : undefined,
      noteId: s.noteId ? noteMap.get(s.noteId) : undefined,
    })),
  };
  await db.put('tasks', task);
  requestReschedule();
  return task;
}

/** Zadanie jako czytelny tekst do wysłania w wiadomości. */
export async function taskAsText(task: Task): Promise<string> {
  const lines = [task.category ? `${task.title} (${task.category})` : task.title, ''];
  let i = 1;
  for (const s of task.steps.filter((x) => x.enabled)) {
    const reps = s.repeat > 1 ? ` ×${s.repeat}` : '';
    let detail = '';
    if (s.type === 'media' && s.mediaId) {
      const m = await db.get('media', s.mediaId);
      if (m?.url) detail = ` – ${m.url}`;
    } else if (s.type === 'text' && s.text) {
      detail = `\n   ${s.text.replace(/\n/g, '\n   ')}`;
    } else if (s.type === 'note' && s.noteId) {
      const n = await db.get('notes', s.noteId);
      if (n) detail = ` – ${n.title}`;
    }
    lines.push(`${i}. ${s.title}${reps}${detail}`);
    i++;
  }
  lines.push('', t('share.scheduleLine', { s: scheduleSummary(task) }), '', `${t('share.footer')}: ${SITE_URL}`);
  return lines.join('\n');
}

function safeName(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l')
      .replace(/Ł/g, 'L')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'zadanie'
  );
}

export type ShareResult = 'shared' | 'copied' | 'downloaded';

/** Udostępnia plik zadania (do importu na innym telefonie). */
export async function shareTaskFile(task: Task): Promise<{ result: ShareResult; blobsSkipped: boolean }> {
  const pkg = await packTask(task);
  const json = JSON.stringify(pkg);
  const name = `nawykomator-${safeName(task.title)}.json`;
  if (isNative()) {
    const written = await Filesystem.writeFile({
      path: `share/${name}`,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({ title: task.title, text: t('share.fileMessage', { title: task.title }), files: [written.uri], dialogTitle: t('share.title') });
    return { result: 'shared', blobsSkipped: !!pkg.blobsSkipped };
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { result: 'downloaded', blobsSkipped: !!pkg.blobsSkipped };
}

/** Udostępnia zadanie jako tekst (komunikator, SMS, notatki). */
export async function shareTaskText(task: Task): Promise<ShareResult> {
  const text = await taskAsText(task);
  if (isNative()) {
    await Share.share({ title: task.title, text, dialogTitle: t('share.title') });
    return 'shared';
  }
  const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
  if (nav.share) {
    await nav.share({ title: task.title, text });
    return 'shared';
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}

export async function readPackageFile(file: File): Promise<Task> {
  const text = await file.text();
  return importPackage(JSON.parse(text));
}
