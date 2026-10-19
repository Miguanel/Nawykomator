// Model danych Nawykomatora. Wszystko trzymane lokalnie w IndexedDB na urządzeniu.

export type MediaKind =
  | 'youtube'
  | 'soundcloud'
  | 'spotify'
  | 'url' // bezpośredni link do pliku audio/wideo albo dowolna strona
  | 'file' // plik wybrany z pamięci telefonu
  | 'voice' // nagranie głosowe zrobione w apce
  | 'image';

export interface MediaItem {
  id: string;
  kind: MediaKind;
  title: string;
  url?: string;
  blobId?: string; // dla file / voice / image
  mime?: string;
  transcript?: string;
  createdAt: number;
}

export interface StoredBlob {
  id: string;
  blob: Blob;
}

export type StepType = 'media' | 'text' | 'note';

export interface Step {
  id: string;
  type: StepType;
  title: string;
  mediaId?: string;
  text?: string;
  noteId?: string;
  /** ile razy odtworzyć / wykonać krok */
  repeat: number;
  /** punkty za ten krok */
  points: number;
  /** false = krok wykluczony z zadania w konfiguracji (nie liczy się i nie jest pokazywany) */
  enabled: boolean;
}

export interface Schedule {
  enabled: boolean;
  /** dni tygodnia 0 = niedziela … 6 = sobota */
  days: number[];
  /** godziny wykonania w ciągu dnia, "HH:MM" – ile godzin, tyle wykonań dziennie */
  times: string[];
  /** co ile minut przypominać, jeśli nie zrobione (0 = nie przypominaj) */
  remindEveryMin: number;
  /** do której godziny przypominać "HH:MM" */
  remindUntil: string;
}

export interface Task {
  id: string;
  title: string;
  category: string;
  color: string;
  steps: Step[];
  schedule: Schedule;
  createdAt: number;
  archived?: boolean;
}

export type NoteBlockType = 'text' | 'audio' | 'image' | 'video';

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  text?: string;
  mediaId?: string;
  /** w pętli nauki: nauczone bloki są pomijane */
  learned?: boolean;
}

export interface Note {
  id: string;
  title: string;
  blocks: NoteBlock[];
  createdAt: number;
  updatedAt: number;
}

export interface EventStep {
  stepId: string;
  title: string;
  mediaId?: string;
  reps: number;
  done: boolean;
  points: number;
}

export type EventType = 'done' | 'interrupted' | 'snoozed';

export interface LogEvent {
  id: string;
  at: number;
  type: EventType;
  taskId: string;
  taskTitle: string;
  category: string;
  slotKey?: string;
  /** manual = user sam potwierdził, guided = przeszedł procedurę "Wykonaj teraz" */
  mode?: 'manual' | 'guided';
  points: number;
  steps: EventStep[];
  interrupted?: { stepIndex: number; rep: number; stepTitle: string };
  snoozeUntil?: number;
}

export interface Snooze {
  /** klucz: taskId|slotKey */
  id: string;
  taskId: string;
  slotKey: string;
  at: number;
  reason: 'snooze' | 'interrupted';
}

export interface RunProgress {
  taskId: string;
  slotKey?: string;
  stepIndex: number;
  rep: number;
  reps: Record<string, number>;
  skipped: string[];
  updatedAt: number;
}

export interface KV {
  key: string;
  value: unknown;
}
