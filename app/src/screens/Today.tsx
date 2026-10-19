import { useEffect, useState, type CSSProperties } from 'react';
import { useApp } from '../app-context';
import { Empty } from '../components/ui';
import * as db from '../db/db';
import type { RunProgress, Task } from '../db/types';
import { DAY_KEYS, t, tn } from '../i18n';
import { useLive, useNow } from '../lib/hooks';
import { getPermissions, requestDisplayPermission } from '../lib/notifications';
import { isNative, openExternal } from '../lib/platform';
import { adhocKey, slotsForDay, type Slot } from '../lib/schedule';
import { addDays, hhmm, startOfDay, sum } from '../lib/util';
import { checkForUpdate, type UpdateInfo } from '../lib/update';

function SlotChip({ slot, now }: { slot: Slot; now: Date }) {
  let cls = 'chip';
  let label = slot.time;
  if (slot.done) {
    cls += ' ok';
    label = `✓ ${slot.time}`;
  } else if (slot.snoozedUntil && slot.snoozedUntil > now.getTime()) {
    cls += ' snoozed';
    label = `${slot.snoozeReason === 'interrupted' ? '↻' : '💤'} ${slot.time} → ${hhmm(new Date(slot.snoozedUntil))}`;
  } else if (slot.at <= now) {
    cls += ' late';
    label = `! ${slot.time}`;
  }
  return <span className={cls}>{label}</span>;
}

function TaskCard({ task, slots, progress, now }: { task: Task; slots: Slot[]; progress?: RunProgress; now: Date }) {
  const app = useApp();
  const pending = slots.filter((s) => !s.done);
  const allDone = slots.length > 0 && pending.length === 0;
  const slotKey = pending[0]?.key ?? adhocKey(now);
  const steps = task.steps.filter((s) => s.enabled);
  const maxPts = sum(steps.map((s) => s.points));

  return (
    <article className={`task-card ${allDone ? 'all-done' : ''}`} style={{ '--task-color': task.color } as CSSProperties}>
      <div className="task-card-top">
        <div>
          <h3>{task.title}</h3>
          <p className="meta">
            {task.category && <span className="cat">{task.category}</span>}
            <span>{tn('today.steps', steps.length)}</span>
            <span>· {t('today.upTo', { n: maxPts })}</span>
          </p>
        </div>
        {allDone && <span className="badge-done">✓</span>}
      </div>
      {slots.length > 0 && (
        <div className="chips">
          {slots.map((s) => (
            <SlotChip key={s.key} slot={s} now={now} />
          ))}
        </div>
      )}
      {progress && (
        <p className="resume-note">
          ↻ {t('today.interrupted', { n: progress.stepIndex + 1, total: steps.length })}
        </p>
      )}
      <div className="task-actions">
        <button className="btn primary" onClick={() => app.runTask(task, slotKey)} disabled={steps.length === 0}>
          ▶ {t('action.run')}
        </button>
        <button className="btn ok" onClick={() => app.openDone(task, slotKey, 'manual')} disabled={steps.length === 0}>
          ✓ {t('action.done')}
        </button>
        {!allDone && (
          <button className="btn ghost" onClick={() => app.openSnooze(task, slotKey)}>
            {t('action.snooze')}
          </button>
        )}
      </div>
    </article>
  );
}

export function Today() {
  const app = useApp();
  const now = useNow();
  const dayStart = startOfDay(now).getTime();
  const tasks = useLive(() => db.getAll('tasks'), [], []);
  const events = useLive(() => db.eventsBetween(dayStart, dayStart + 86_400_000), [dayStart], []);
  const snoozes = useLive(() => db.getAll('snoozes'), [], []);
  const progress = useLive(() => db.getAll('progress'), [], []);
  const [notifOk, setNotifOk] = useState(true);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    if (isNative()) getPermissions().then((p) => setNotifOk(p.display === 'granted'));
    checkForUpdate().then(setUpdate);
  }, []);

  const active = tasks.filter((x) => !x.archived);
  const withSlots = active.map((task) => ({ task, slots: slotsForDay(task, now, events, snoozes) }));
  const scheduled = withSlots.filter((x) => x.slots.length > 0);
  const other = withSlots.filter((x) => x.slots.length === 0);
  const done = events.filter((e) => e.type === 'done');
  const points = sum(done.map((e) => e.points));
  const totalSlots = sum(scheduled.map((x) => x.slots.length));
  const doneSlots = sum(scheduled.map((x) => x.slots.filter((s) => s.done).length));
  const progressOf = (id: string) => progress.find((p) => p.taskId === id);

  return (
    <div className="screen">
      <header className="today-head">
        <div>
          <p className="eyebrow">
            {t(DAY_KEYS[now.getDay()])}, {now.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
          </p>
          <h1>{t('today.title')}</h1>
        </div>
        <div className="score" aria-label={t('today.points')}>
          <strong>{points}</strong>
          <span>{t('common.pts')}</span>
        </div>
      </header>

      {totalSlots > 0 && (
        <div className="day-progress" aria-label={t('today.progress', { done: doneSlots, total: totalSlots })}>
          <div className="bar">
            <div style={{ width: `${(doneSlots / totalSlots) * 100}%` }} />
          </div>
          <span>{t('today.progress', { done: doneSlots, total: totalSlots })}</span>
        </div>
      )}

      {update && (
        <div className="banner">
          <span>{t('update.available', { v: update.version })}</span>
          <button className="btn small primary" onClick={() => openExternal(update.apk)}>
            {t('update.download')}
          </button>
        </div>
      )}

      {!notifOk && (
        <div className="banner warn">
          <span>{t('today.notifOff')}</span>
          <button
            className="btn small"
            onClick={async () => {
              await requestDisplayPermission();
              setNotifOk((await getPermissions()).display === 'granted');
            }}
          >
            {t('today.notifOn')}
          </button>
        </div>
      )}

      {active.length === 0 ? (
        <Empty icon="🌱" text={t('today.empty')}>
          <button className="btn primary" onClick={() => app.push({ name: 'task-edit' })}>
            + {t('tasks.new')}
          </button>
        </Empty>
      ) : (
        <>
          {scheduled.length === 0 && <p className="muted center">{t('today.nothingToday')}</p>}
          <div className="cards">
            {scheduled.map(({ task, slots }) => (
              <TaskCard key={task.id} task={task} slots={slots} progress={progressOf(task.id)} now={now} />
            ))}
          </div>
          {other.length > 0 && (
            <>
              <h2 className="section-title">{t('today.other')}</h2>
              <div className="cards">
                {other.map(({ task }) => (
                  <TaskCard key={task.id} task={task} slots={[]} progress={progressOf(task.id)} now={now} />
                ))}
              </div>
            </>
          )}
          <TomorrowHint tasks={active} now={now} />
        </>
      )}
    </div>
  );
}

function TomorrowHint({ tasks, now }: { tasks: Task[]; now: Date }) {
  const tomorrow = addDays(now, 1);
  const n = sum(tasks.map((x) => slotsForDay(x, tomorrow, [], []).length));
  if (!n) return null;
  return <p className="muted center small">{t('today.tomorrow', { n })}</p>;
}
