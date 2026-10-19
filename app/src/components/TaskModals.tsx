import { Icon } from './Icon';
import { useState } from 'react';
import type { DonePreset } from '../app-context';
import type { Task } from '../db/types';
import { t } from '../i18n';
import { completeTask, enabledSteps, snoozeTask } from '../lib/actions';
import { addDays, atTime } from '../lib/util';
import { Modal } from './ui';

/**
 * "Zrobione" – punkty naliczane dopiero po potwierdzeniu.
 * User może odznaczyć podzadania, których nie zrobił w pełni.
 * Kroki wykluczone w konfiguracji zadania nie są tu w ogóle pokazywane.
 */
export function DoneModal({
  task,
  slotKey,
  mode,
  preset,
  onClose,
  onDone,
}: {
  task: Task;
  slotKey: string;
  mode: 'manual' | 'guided';
  preset?: DonePreset;
  onClose: () => void;
  onDone: (points: number) => void;
}) {
  const steps = enabledSteps(task);
  const [checked, setChecked] = useState<string[]>(preset?.checked ?? steps.map((s) => s.id));
  const [busy, setBusy] = useState(false);
  const points = steps.filter((s) => checked.includes(s.id)).reduce((a, s) => a + s.points, 0);

  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const confirm = async () => {
    setBusy(true);
    await completeTask(task, { slotKey, mode, checked, reps: preset?.reps });
    onDone(points);
  };

  return (
    <Modal
      title={t('done.title')}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn primary" disabled={busy || checked.length === 0} onClick={confirm}>
            <Icon name="check" size={18} /> {t('done.confirm', { n: points })}
          </button>
        </>
      }
    >
      <p className="modal-task">
        <span className="dot" style={{ background: task.color }} /> {task.title}
      </p>
      <p className="hint">{t('done.hint')}</p>
      <ul className="check-list">
        {steps.map((s) => (
          <li key={s.id}>
            <label>
              <input type="checkbox" checked={checked.includes(s.id)} onChange={() => toggle(s.id)} />
              <span className="check-title">
                {s.title}
                {s.repeat > 1 && <small> ×{preset?.reps[s.id] !== undefined ? `${preset.reps[s.id]}/${s.repeat}` : s.repeat}</small>}
              </span>
              <span className="pts">+{s.points}</span>
            </label>
          </li>
        ))}
      </ul>
      {checked.length === 0 && <p className="error">{t('done.pickOne')}</p>}
    </Modal>
  );
}

/** "Odłóż…" – 5 / 15 / 50 min albo inna godzina. Bez punktów, potem kolejne przypomnienie. */
export function SnoozeModal({
  task,
  slotKey,
  onClose,
  onSnoozed,
}: {
  task: Task;
  slotKey: string;
  onClose: () => void;
  onSnoozed: (at: Date) => void;
}) {
  const [custom, setCustom] = useState('');

  const go = async (at: Date) => {
    await snoozeTask(task, slotKey, at.getTime());
    onSnoozed(at);
  };
  const inMin = (m: number) => go(new Date(Date.now() + m * 60_000));
  const atCustom = () => {
    if (!custom) return;
    let d = atTime(new Date(), custom);
    if (d.getTime() <= Date.now()) d = addDays(d, 1);
    go(d);
  };

  return (
    <Modal title={t('snooze.title')} onClose={onClose}>
      <p className="modal-task">
        <span className="dot" style={{ background: task.color }} /> {task.title}
      </p>
      <div className="snooze-grid">
        {[5, 15, 50].map((m) => (
          <button key={m} className="btn big" onClick={() => inMin(m)}>
            {t('snooze.min', { n: m })}
          </button>
        ))}
      </div>
      <div className="snooze-custom">
        <label>
          {t('snooze.other')}
          <input type="time" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </label>
        <button className="btn primary" disabled={!custom} onClick={atCustom}>
          {t('snooze.set')}
        </button>
      </div>
      <p className="hint">{t('snooze.hint')}</p>
    </Modal>
  );
}
