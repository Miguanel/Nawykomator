// Operacje na zadaniach: zrobione, odłóż, przerwij. Punkty TYLKO w completeTask.
import * as db from '../db/db';
import type { EventStep, LogEvent, RunProgress, Task } from '../db/types';
import { requestReschedule } from './notifications';
import { snoozeId } from './schedule';
import { uid } from './util';

export const enabledSteps = (task: Task) => task.steps.filter((s) => s.enabled);

export async function completeTask(
  task: Task,
  opts: { slotKey: string; mode: 'manual' | 'guided'; checked: string[]; reps?: Record<string, number> },
): Promise<LogEvent> {
  const steps: EventStep[] = enabledSteps(task).map((s) => {
    const done = opts.checked.includes(s.id);
    return {
      stepId: s.id,
      title: s.title,
      mediaId: s.mediaId,
      reps: done ? (opts.reps?.[s.id] ?? s.repeat) : (opts.reps?.[s.id] ?? 0),
      done,
      points: done ? s.points : 0,
    };
  });
  const ev: LogEvent = {
    id: uid(),
    at: Date.now(),
    type: 'done',
    taskId: task.id,
    taskTitle: task.title,
    category: task.category,
    slotKey: opts.slotKey,
    mode: opts.mode,
    points: steps.reduce((a, s) => a + s.points, 0),
    steps,
  };
  await db.put('events', ev);
  await db.del('snoozes', snoozeId(task.id, opts.slotKey));
  await db.del('progress', task.id);
  requestReschedule();
  return ev;
}

export async function snoozeTask(task: Task, slotKey: string, at: number): Promise<void> {
  await db.put('snoozes', { id: snoozeId(task.id, slotKey), taskId: task.id, slotKey, at, reason: 'snooze' });
  await db.put('events', {
    id: uid(),
    at: Date.now(),
    type: 'snoozed',
    taskId: task.id,
    taskTitle: task.title,
    category: task.category,
    slotKey,
    points: 0,
    steps: [],
    snoozeUntil: at,
  });
  requestReschedule();
}

export const RESUME_AFTER_MIN = 60;

export async function interruptRun(task: Task, progress: RunProgress): Promise<void> {
  const steps = enabledSteps(task);
  const slotKey = progress.slotKey ?? '';
  await db.put('progress', { ...progress, updatedAt: Date.now() });
  await db.put('events', {
    id: uid(),
    at: Date.now(),
    type: 'interrupted',
    taskId: task.id,
    taskTitle: task.title,
    category: task.category,
    slotKey,
    points: 0,
    steps: steps.map((s) => ({
      stepId: s.id,
      title: s.title,
      mediaId: s.mediaId,
      reps: progress.reps[s.id] ?? 0,
      done: (progress.reps[s.id] ?? 0) >= s.repeat,
      points: 0,
    })),
    interrupted: {
      stepIndex: progress.stepIndex,
      rep: progress.rep,
      stepTitle: steps[progress.stepIndex]?.title ?? '',
    },
  });
  if (slotKey) {
    await db.put('snoozes', {
      id: snoozeId(task.id, slotKey),
      taskId: task.id,
      slotKey,
      at: Date.now() + RESUME_AFTER_MIN * 60_000,
      reason: 'interrupted',
    });
  }
  requestReschedule();
}

// --- zarządzanie zadaniami ---

/** Archiwum: zadanie znika z "Dziś" i nie przypomina, ale można je przywrócić. */
export async function archiveTask(task: Task): Promise<void> {
  await db.put('tasks', { ...task, archived: true });
  await db.del('progress', task.id);
  for (const s of await db.getAll('snoozes')) if (s.taskId === task.id) await db.del('snoozes', s.id);
  requestReschedule();
}

export async function restoreTask(task: Task): Promise<void> {
  await db.put('tasks', { ...task, archived: false });
  requestReschedule();
}

/** Kopia zadania z nowymi id (nagrania są współdzielone, nie kopiujemy plików). */
export async function duplicateTask(task: Task, suffix: string): Promise<Task> {
  const copy: Task = {
    ...task,
    id: uid(),
    title: `${task.title} ${suffix}`.trim(),
    archived: false,
    createdAt: Date.now(),
    steps: task.steps.map((s) => ({ ...s, id: uid() })),
  };
  await db.put('tasks', copy);
  requestReschedule();
  return copy;
}

/**
 * Usunięcie na zawsze. Historia (zdarzenia w statystykach) zostaje.
 * Nagrania z kroków kasujemy tylko wtedy, gdy nie używa ich inne zadanie ani notatka.
 */
export async function deleteTaskForever(task: Task): Promise<void> {
  await db.del('tasks', task.id);
  await db.del('progress', task.id);
  for (const s of await db.getAll('snoozes')) if (s.taskId === task.id) await db.del('snoozes', s.id);

  const [tasks, notes] = await Promise.all([db.getAll('tasks'), db.getAll('notes')]);
  const used = new Set<string>();
  tasks.forEach((x) => x.steps.forEach((s) => s.mediaId && used.add(s.mediaId)));
  notes.forEach((n) => n.blocks.forEach((b) => b.mediaId && used.add(b.mediaId)));
  for (const s of task.steps) {
    if (s.mediaId && !used.has(s.mediaId)) {
      const m = await db.get('media', s.mediaId);
      if (m?.blobId) await db.del('blobs', m.blobId);
      await db.del('media', s.mediaId);
    }
  }
  requestReschedule();
}
