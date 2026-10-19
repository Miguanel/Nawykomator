import { createContext, useContext } from 'react';
import type { Task } from './db/types';

export type TabName = 'today' | 'tasks' | 'notes' | 'stats' | 'more';

export type Route =
  | { name: TabName }
  | { name: 'task-edit'; id?: string }
  | { name: 'run'; taskId: string; slotKey: string; resume?: boolean }
  | { name: 'note-edit'; id?: string }
  | { name: 'note-play'; id: string; learn?: boolean };

export interface DonePreset {
  checked: string[];
  reps: Record<string, number>;
}

export interface AppApi {
  route: Route;
  push: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
  tab: (t: TabName) => void;
  openDone: (task: Task, slotKey: string, mode: 'manual' | 'guided', preset?: DonePreset) => void;
  openSnooze: (task: Task, slotKey: string) => void;
  runTask: (task: Task, slotKey: string) => void;
  toast: (msg: string) => void;
  /** ekran może przechwycić systemowy przycisk "wstecz" (zwraca true = obsłużone) */
  setBackGuard: (fn: (() => boolean) | null) => void;
}

export const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext');
  return ctx;
}
