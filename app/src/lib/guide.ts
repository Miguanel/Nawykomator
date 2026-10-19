// Przewodnik dla nowych użytkowników: ekran powitalny, lista "Pierwsze kroki" i podpowiedzi.
import * as db from '../db/db';
import type { Task } from '../db/types';
import { DEFAULT_STEP_POINTS, TASK_COLORS } from '../config';
import { t, type TKey } from '../i18n';
import { useLive } from './hooks';
import { requestReschedule } from './notifications';
import { uid } from './util';

export interface GuideState {
  onboarded: boolean;
  hidden: boolean; // lista "Pierwsze kroki" schowana
  visitedStats: boolean;
  tipsHidden: string[];
}

const KEY = 'guide';
const DEFAULT: GuideState = { onboarded: false, hidden: false, visitedStats: false, tipsHidden: [] };

export async function getGuide(): Promise<GuideState> {
  return { ...DEFAULT, ...(await db.kvGet<Partial<GuideState>>(KEY, {})) };
}

export async function updateGuide(p: Partial<GuideState>): Promise<void> {
  await db.kvSet(KEY, { ...(await getGuide()), ...p });
}

export type GuideItemId = 'task' | 'media' | 'schedule' | 'run' | 'snooze' | 'voice' | 'stats';

export interface GuideItem {
  id: GuideItemId;
  title: TKey;
  text: TKey;
  done: boolean;
}

const ITEMS: { id: GuideItemId; title: TKey; text: TKey }[] = [
  { id: 'task', title: 'guide.i.task', text: 'guide.i.taskText' },
  { id: 'media', title: 'guide.i.media', text: 'guide.i.mediaText' },
  { id: 'schedule', title: 'guide.i.schedule', text: 'guide.i.scheduleText' },
  { id: 'run', title: 'guide.i.run', text: 'guide.i.runText' },
  { id: 'snooze', title: 'guide.i.snooze', text: 'guide.i.snoozeText' },
  { id: 'voice', title: 'guide.i.voice', text: 'guide.i.voiceText' },
  { id: 'stats', title: 'guide.i.stats', text: 'guide.i.statsText' },
];

interface GuideData {
  state: GuideState;
  items: GuideItem[];
  doneCount: number;
  ready: boolean;
}

async function load(): Promise<GuideData> {
  const [state, tasks, events, notes] = await Promise.all([getGuide(), db.getAll('tasks'), db.getAll('events'), db.getAll('notes')]);
  const active = tasks.filter((x) => !x.archived);
  const flags: Record<GuideItemId, boolean> = {
    task: active.length > 0,
    media: active.some((x) => x.steps.some((s) => s.type === 'media' && s.mediaId)),
    schedule: active.some((x) => x.schedule.enabled && x.schedule.times.length > 0),
    run: events.some((e) => e.type === 'done' && e.mode === 'guided'),
    snooze: events.some((e) => e.type === 'snoozed'),
    voice: notes.some((n) => n.blocks.some((b) => b.type === 'audio')),
    stats: state.visitedStats,
  };
  const items = ITEMS.map((i) => ({ ...i, done: flags[i.id] }));
  return { state, items, doneCount: items.filter((i) => i.done).length, ready: true };
}

export function useGuide(): GuideData {
  return useLive(load, [], { state: DEFAULT, items: [], doneCount: 0, ready: false });
}

/** Podpowiedzi pokazujemy, dopóki user nie przejdzie wszystkich pierwszych kroków i ich nie zamknie. */
export function tipVisible(g: GuideData, id: string): boolean {
  return g.ready && !g.state.hidden && g.doneCount < ITEMS.length && !g.state.tipsHidden.includes(id);
}

export async function hideTip(id: string): Promise<void> {
  const s = await getGuide();
  if (!s.tipsHidden.includes(id)) await updateGuide({ tipsHidden: [...s.tipsHidden, id] });
}

/** Przykładowe zadanie, żeby od razu było co wypróbować. */
export async function createSampleTask(): Promise<Task> {
  const step = (title: string, text: string, repeat: number, points = DEFAULT_STEP_POINTS) => ({
    id: uid(),
    type: 'text' as const,
    title,
    text,
    repeat,
    points,
    enabled: true,
  });
  const task: Task = {
    id: uid(),
    title: t('sample.title'),
    category: t('sample.category'),
    color: TASK_COLORS[0],
    steps: [
      step(t('sample.s1'), t('sample.s1text'), 1, 5),
      step(t('sample.s2'), t('sample.s2text'), 2),
      step(t('sample.s3'), t('sample.s3text'), 5),
    ],
    schedule: { enabled: true, days: [0, 1, 2, 3, 4, 5, 6], times: ['07:30'], remindEveryMin: 60, remindUntil: '12:00' },
    createdAt: Date.now(),
  };
  await db.put('tasks', task);
  requestReschedule();
  return task;
}
