// Minimalny wrapper na IndexedDB (bez zewnętrznych bibliotek).
import type { KV, LogEvent, MediaItem, Note, RunProgress, Snooze, StoredBlob, Task } from './types';

const DB_NAME = 'nawykomator';
const DB_VERSION = 1;

export interface Stores {
  tasks: Task;
  notes: Note;
  media: MediaItem;
  blobs: StoredBlob;
  events: LogEvent;
  snoozes: Snooze;
  progress: RunProgress;
  kv: KV;
}
export type StoreName = keyof Stores;

const KEY_PATHS: Record<StoreName, string> = {
  tasks: 'id',
  notes: 'id',
  media: 'id',
  blobs: 'id',
  events: 'id',
  snoozes: 'id',
  progress: 'taskId',
  kv: 'key',
};

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of Object.keys(KEY_PATHS) as StoreName[]) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: KEY_PATHS[name] });
          if (name === 'events') store.createIndex('at', 'at');
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- powiadamianie widoków o zmianach ---
type Listener = () => void;
const listeners = new Set<Listener>();
export function onDbChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((fn) => fn());
}

export async function getAll<N extends StoreName>(name: N): Promise<Stores[N][]> {
  const db = await open();
  return wrap(db.transaction(name).objectStore(name).getAll()) as Promise<Stores[N][]>;
}

export async function get<N extends StoreName>(name: N, key: string): Promise<Stores[N] | undefined> {
  const db = await open();
  return wrap(db.transaction(name).objectStore(name).get(key)) as Promise<Stores[N] | undefined>;
}

export async function put<N extends StoreName>(name: N, value: Stores[N]): Promise<void> {
  const db = await open();
  await wrap(db.transaction(name, 'readwrite').objectStore(name).put(value));
  emit();
}

export async function del<N extends StoreName>(name: N, key: string): Promise<void> {
  const db = await open();
  await wrap(db.transaction(name, 'readwrite').objectStore(name).delete(key));
  emit();
}

export async function eventsBetween(from: number, to: number): Promise<LogEvent[]> {
  const db = await open();
  const idx = db.transaction('events').objectStore('events').index('at');
  return wrap(idx.getAll(IDBKeyRange.bound(from, to))) as Promise<LogEvent[]>;
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = await get('kv', key);
  return row ? (row.value as T) : fallback;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await put('kv', { key, value });
}
