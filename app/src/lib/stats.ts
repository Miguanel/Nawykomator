import type { LogEvent } from '../db/types';
import { addDays, dayKey, startOfDay } from './util';

export interface Row {
  key: string;
  label: string;
  count: number;
  points: number;
}

export interface MonthStats {
  points: number;
  done: number;
  guided: number;
  manual: number;
  interrupted: number;
  snoozed: number;
  daily: { day: number; points: number; done: number }[];
  byCategory: Row[];
  byTask: Row[];
  byMedia: { mediaId: string; label: string; plays: number }[];
  interruptions: LogEvent[];
}

function group(events: LogEvent[], key: (e: LogEvent) => string, label: (e: LogEvent) => string): Row[] {
  const m = new Map<string, Row>();
  for (const e of events) {
    const k = key(e);
    const r = m.get(k) ?? { key: k, label: label(e), count: 0, points: 0 };
    r.count += 1;
    r.points += e.points;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.points - a.points || b.count - a.count);
}

export function monthStats(events: LogEvent[], year: number, month: number, mediaTitle: (id: string) => string, noCategory: string): MonthStats {
  const days = new Date(year, month + 1, 0).getDate();
  const done = events.filter((e) => e.type === 'done');
  const daily = Array.from({ length: days }, (_, i) => ({ day: i + 1, points: 0, done: 0 }));
  for (const e of done) {
    const d = new Date(e.at).getDate() - 1;
    if (daily[d]) {
      daily[d].points += e.points;
      daily[d].done += 1;
    }
  }
  const plays = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'done' && e.type !== 'interrupted') continue;
    for (const s of e.steps) if (s.mediaId && s.reps > 0) plays.set(s.mediaId, (plays.get(s.mediaId) ?? 0) + s.reps);
  }
  return {
    points: done.reduce((a, e) => a + e.points, 0),
    done: done.length,
    guided: done.filter((e) => e.mode === 'guided').length,
    manual: done.filter((e) => e.mode === 'manual').length,
    interrupted: events.filter((e) => e.type === 'interrupted').length,
    snoozed: events.filter((e) => e.type === 'snoozed').length,
    daily,
    byCategory: group(done, (e) => e.category || '-', (e) => e.category || noCategory),
    byTask: group(done, (e) => e.taskId, (e) => e.taskTitle),
    byMedia: [...plays.entries()]
      .map(([mediaId, n]) => ({ mediaId, label: mediaTitle(mediaId), plays: n }))
      .sort((a, b) => b.plays - a.plays),
    interruptions: events.filter((e) => e.type === 'interrupted').sort((a, b) => b.at - a.at),
  };
}

/** Ile dni z rzędu (do dziś lub do wczoraj) zadanie było zrobione co najmniej raz. */
export function streak(allDone: LogEvent[], taskId: string, today = new Date()): number {
  const days = new Set(allDone.filter((e) => e.taskId === taskId && e.type === 'done').map((e) => dayKey(new Date(e.at))));
  let d = startOfDay(today);
  if (!days.has(dayKey(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
