// Liczenie "slotów" (zaplanowanych wykonań) i godzin przypomnień.
import type { LogEvent, Snooze, Task } from '../db/types';
import { addDays, atTime, dayKey, startOfDay } from './util';

export interface Slot {
  key: string; // "2026-10-19@07:00"
  time: string;
  at: Date;
  done: boolean;
  snoozedUntil?: number;
  snoozeReason?: Snooze['reason'];
}

export const snoozeId = (taskId: string, slotKey: string) => `${taskId}|${slotKey}`;
/** klucz dla wykonania poza harmonogramem w danym dniu */
export const adhocKey = (day: Date) => `${dayKey(day)}@*`;

export function isScheduledOn(task: Task, day: Date): boolean {
  const s = task.schedule;
  return s.enabled && s.times.length > 0 && s.days.includes(day.getDay());
}

export function slotsForDay(task: Task, day: Date, events: LogEvent[], snoozes: Snooze[]): Slot[] {
  if (!isScheduledOn(task, day)) return [];
  const dk = dayKey(day);
  const doneKeys = new Set(events.filter((e) => e.type === 'done' && e.taskId === task.id).map((e) => e.slotKey));
  return [...task.schedule.times]
    .sort()
    .map((time) => {
      const key = `${dk}@${time}`;
      const sn = snoozes.find((s) => s.id === snoozeId(task.id, key));
      return {
        key,
        time,
        at: atTime(day, time),
        done: doneKeys.has(key),
        snoozedUntil: sn?.at,
        snoozeReason: sn?.reason,
      };
    });
}

/** Do którego slotu przypisać wykonanie / odłożenie zrobione "teraz". */
export function currentSlotKey(task: Task, now: Date, events: LogEvent[], snoozes: Snooze[]): string {
  const pending = slotsForDay(task, now, events, snoozes).filter((s) => !s.done);
  return pending[0]?.key ?? adhocKey(now);
}

export interface PlannedReminder {
  id: string; // unikalny klucz (na id powiadomienia robimy hash)
  taskId: string;
  slotKey: string;
  at: Date;
  kind: 'due' | 'nag' | 'snooze' | 'resume';
  time: string;
}

/** Wszystkie przypomnienia od teraz na `horizonDays` dni do przodu. */
export function planReminders(
  tasks: Task[],
  events: LogEvent[],
  snoozes: Snooze[],
  now: Date,
  horizonDays = 3,
  cap = 300,
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const nowMs = now.getTime();
  const usedSnoozes = new Set<string>();

  for (const task of tasks) {
    if (task.archived) continue;
    for (let d = 0; d < horizonDays; d++) {
      const day = addDays(startOfDay(now), d);
      const slots = slotsForDay(task, day, events, snoozes);
      slots.forEach((slot, i) => {
        if (slot.done) return;
        const sn = snoozes.find((s) => s.id === snoozeId(task.id, slot.key));
        if (sn) usedSnoozes.add(sn.id);
        const next = slots[i + 1]?.at.getTime() ?? Infinity;
        const until = atTime(day, task.schedule.remindUntil || '22:00').getTime();
        const every = task.schedule.remindEveryMin * 60_000;

        const base = sn ? sn.at : slot.at.getTime();
        const first: PlannedReminder['kind'] = sn ? (sn.reason === 'interrupted' ? 'resume' : 'snooze') : 'due';
        const times: [number, PlannedReminder['kind']][] = [[base, first]];
        if (every > 0) {
          const end = Math.min(until, next);
          for (let t = base + every; t < end; t += every) times.push([t, 'nag']);
        }
        for (const [t, kind] of times) {
          if (t <= nowMs) continue;
          out.push({ id: `${task.id}|${slot.key}|${t}`, taskId: task.id, slotKey: slot.key, at: new Date(t), kind, time: slot.time });
        }
      });
    }
  }

  // odłożenia / przerwania zadań poza harmonogramem
  for (const sn of snoozes) {
    if (usedSnoozes.has(sn.id) || sn.at <= nowMs) continue;
    if (!tasks.some((t) => t.id === sn.taskId && !t.archived)) continue;
    out.push({
      id: `${sn.id}|${sn.at}`,
      taskId: sn.taskId,
      slotKey: sn.slotKey,
      at: new Date(sn.at),
      kind: sn.reason === 'interrupted' ? 'resume' : 'snooze',
      time: '',
    });
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.slice(0, cap);
}
