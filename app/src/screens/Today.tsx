import { useEffect, useState, type CSSProperties } from 'react';
import { useApp } from '../app-context';
import { GuideCard } from '../components/GuideCard';
import { Icon } from '../components/Icon';
import { Empty, LeafProgress, TreeRings } from '../components/ui';
import * as db from '../db/db';
import type { RunProgress, Task } from '../db/types';
import { DAY_KEYS, t, tn } from '../i18n';
import { useLive, useNow } from '../lib/hooks';
import { getPermissions, requestDisplayPermission } from '../lib/notifications';
import { isNative, openExternal } from '../lib/platform';
import { adhocKey, slotsForDay, type Slot } from '../lib/schedule';
import { addDays, hhmm, startOfDay, sum } from '../lib/util';
import { checkForUpdate, type UpdateInfo } from '../lib/update';

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return t('today.hiNight');
  if (h < 12) return t('today.hiMorning');
  if (h < 18) return t('today.hiDay');
  return t('today.hiEvening');
}

function SlotChip({ slot, now }: { slot: Slot; now: Date }) {
  if (slot.done)
    return (
      <span className="chip ok">
        <Icon name="check" size={14} /> {slot.time}
      </span>
    );
  if (slot.snoozedUntil && slot.snoozedUntil > now.getTime())
    return (
      <span className="chip snoozed" title={slot.snoozeReason === 'interrupted' ? t('today.resumeAt') : t('today.snoozedTo')}>
        <Icon name={slot.snoozeReason === 'interrupted' ? 'restart' : 'clock'} size={14} /> {slot.time}
        <span className="chip-sub">{t('today.until', { time: hhmm(new Date(slot.snoozedUntil)) })}</span>
      </span>
    );
  if (slot.at <= now)
    return (
      <span className="chip late">
        <Icon name="clock" size={14} /> {slot.time}
        <span className="chip-sub">{t('today.overdue')}</span>
      </span>
    );
  return (
    <span className="chip">
      <Icon name="clock" size={14} /> {slot.time}
    </span>
  );
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
        <div className="task-card-title">
          <h3>{task.title}</h3>
          <p className="meta">
            {task.category && <span className="cat">{task.category}</span>}
            <span>{tn('today.steps', steps.length)}</span>
            <span className="pts-label">{t('today.upTo', { n: maxPts })}</span>
          </p>
        </div>
        {allDone && (
          <span className="badge-done" aria-label={t('today.allDone')}>
            <Icon name="check" size={18} />
          </span>
        )}
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
          <Icon name="restart" size={16} /> {t('today.interrupted', { n: progress.stepIndex + 1, total: steps.length })}
        </p>
      )}
      <div className="task-actions">
        <button className="btn primary" onClick={() => app.runTask(task, slotKey)} disabled={steps.length === 0}>
          <Icon name="play" size={16} /> {t('action.run')}
        </button>
        <button className="btn ok" onClick={() => app.openDone(task, slotKey, 'manual')} disabled={steps.length === 0}>
          <Icon name="check" size={18} /> {t('action.done')}
        </button>
        {!allDone && (
          <button className="btn ghost" onClick={() => app.openSnooze(task, slotKey)}>
            <Icon name="clock" size={18} /> {t('action.snooze')}
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
  const points = sum(events.filter((e) => e.type === 'done').map((e) => e.points));
  const totalSlots = sum(scheduled.map((x) => x.slots.length));
  const doneSlots = sum(scheduled.map((x) => x.slots.filter((s) => s.done).length));
  const progressOf = (id: string) => progress.find((p) => p.taskId === id);
  const tomorrow = sum(active.map((x) => slotsForDay(x, addDays(now, 1), [], []).length));

  return (
    <div className="screen">
      <header className="plank">
        <div className="plank-text">
          <p className="plank-date">
            {t(DAY_KEYS[now.getDay()])}, {now.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
          </p>
          <h1>{greeting(now)}</h1>
          {totalSlots > 0 ? (
            <div className="plank-progress">
              <LeafProgress done={doneSlots} total={totalSlots} />
              <span>{t('today.progress', { done: doneSlots, total: totalSlots })}</span>
            </div>
          ) : (
            <p className="plank-sub">{t('today.noPlan')}</p>
          )}
        </div>
        <TreeRings points={points} label={t('common.pts')} />
      </header>

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

      <GuideCard />

      {active.length === 0 ? (
        <Empty icon="sprout" text={t('today.empty')}>
          <button className="btn primary" onClick={() => app.push({ name: 'task-edit' })}>
            <Icon name="plus" size={18} /> {t('tasks.new')}
          </button>
        </Empty>
      ) : (
        <>
          {scheduled.length > 0 && <h2 className="section-title">{t('today.planned')}</h2>}
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
          {tomorrow > 0 && <p className="muted center small">{t('today.tomorrow', { n: tomorrow })}</p>}
        </>
      )}
    </div>
  );
}
