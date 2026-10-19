import { hideTip, tipVisible, useGuide } from '../lib/guide';
import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { DictateButton, MediaPicker } from '../components/MediaPicker';
import { Header, Modal, Stepper, Tip, Toggle } from '../components/ui';
import { TaskMenu, type MenuView } from '../components/TaskMenu';
import { duplicateTask } from '../lib/actions';
import { DEFAULT_STEP_POINTS, TASK_COLORS } from '../config';
import * as db from '../db/db';
import type { MediaItem, Note, Step, Task } from '../db/types';
import { DAY_KEYS, t, WEEK_ORDER } from '../i18n';
import { useLive } from '../lib/hooks';
import { KIND_ICON } from '../lib/media';
import { requestReschedule } from '../lib/notifications';
import { uid } from '../lib/util';

function newTask(): Task {
  return {
    id: uid(),
    title: '',
    category: '',
    color: TASK_COLORS[0],
    steps: [],
    schedule: { enabled: true, days: [0, 1, 2, 3, 4, 5, 6], times: ['08:00'], remindEveryMin: 60, remindUntil: '22:00' },
    createdAt: Date.now(),
  };
}

function newStep(type: Step['type'], extra: Partial<Step> = {}): Step {
  return { id: uid(), type, title: '', repeat: 1, points: DEFAULT_STEP_POINTS, enabled: true, ...extra };
}

export function TaskEditor({ id }: { id?: string }) {
  const app = useApp();
  const [task, setTask] = useState<Task | null>(id ? null : newTask());
  const [picker, setPicker] = useState<{ stepId?: string } | null>(null);
  const [menu, setMenu] = useState<MenuView | null>(null);
  const [saved, setSaved] = useState<Task | null>(null);
  const [error, setError] = useState('');
  const media = useLive(() => db.getAll('media'), [], [] as MediaItem[]);
  const notes = useLive(() => db.getAll('notes'), [], [] as Note[]);
  const allTasks = useLive(() => db.getAll('tasks'), [], [] as Task[]);
  const categories = [...new Set(allTasks.map((x) => x.category).filter(Boolean))];
  const guide = useGuide();

  useEffect(() => {
    if (id) db.get('tasks', id).then((x) => setTask(x ?? newTask()));
  }, [id]);

  if (!task) return null;

  const patch = (p: Partial<Task>) => setTask({ ...task, ...p });
  const patchSchedule = (p: Partial<Task['schedule']>) => patch({ schedule: { ...task.schedule, ...p } });
  const patchStep = (sid: string, p: Partial<Step>) => patch({ steps: task.steps.map((s) => (s.id === sid ? { ...s, ...p } : s)) });
  const moveStep = (i: number, d: -1 | 1) => {
    const steps = [...task.steps];
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    patch({ steps });
  };
  const removeStep = (sid: string) => patch({ steps: task.steps.filter((s) => s.id !== sid) });

  const onPicked = (m: MediaItem) => {
    if (picker?.stepId) patchStep(picker.stepId, { mediaId: m.id });
    else patch({ steps: [...task.steps, newStep('media', { mediaId: m.id, title: m.title })] });
    setPicker(null);
  };

  /** Zapisuje zadanie; zwraca zapisaną wersję albo null, gdy brakuje nazwy. */
  const persist = async (): Promise<Task | null> => {
    if (!task.title.trim()) {
      setError(t('editor.needTitle'));
      return null;
    }
    const steps = task.steps.map((s, i) => ({ ...s, title: s.title.trim() || `${t('editor.step')} ${i + 1}` }));
    const clean = { ...task, title: task.title.trim(), category: task.category.trim(), steps };
    await db.put('tasks', clean);
    requestReschedule();
    return clean;
  };

  const save = async () => {
    if (!(await persist())) return;
    app.toast(t('editor.saved'));
    app.back();
  };

  const duplicate = async () => {
    const s = await persist();
    if (!s) return;
    const copy = await duplicateTask(s, t('manage.copySuffix'));
    app.toast(t('manage.duplicated'));
    app.replace({ name: 'task-edit', id: copy.id });
  };

  /** Akcje zarządzania działają na zapisanej wersji zadania. */
  const openMenu = async (view: MenuView) => {
    const s = await persist();
    if (!s) return;
    setSaved(s);
    setMenu(view);
  };

  const toggleDay = (d: number) =>
    patchSchedule({ days: task.schedule.days.includes(d) ? task.schedule.days.filter((x) => x !== d) : [...task.schedule.days, d] });

  return (
    <div className="screen editor">
      <Header
        title={id ? t('editor.editTitle') : t('editor.newTitle')}
        onBack={app.back}
        right={
          <button className="btn primary small" onClick={save}>
            {t('common.save')}
          </button>
        }
      />

      {tipVisible(guide, 'editor') && <Tip onClose={() => hideTip('editor')}>{t('tip.editor')}</Tip>}
      <section className="card form">
        <label>
          {t('editor.name')}
          <input value={task.title} placeholder={t('editor.namePlaceholder')} onChange={(e) => patch({ title: e.target.value })} />
        </label>
        {error && <p className="error">{error}</p>}
        <label>
          {t('editor.category')}
          <input list="cats" value={task.category} placeholder={t('editor.categoryPlaceholder')} onChange={(e) => patch({ category: e.target.value })} />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <div className="colors" role="radiogroup" aria-label={t('editor.color')}>
          {TASK_COLORS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={task.color === c}
              className={`swatch ${task.color === c ? 'on' : ''}`}
              style={{ background: c }}
              onClick={() => patch({ color: c })}
            />
          ))}
        </div>
      </section>

      <h2 className="section-title">{t('editor.steps')}</h2>
      <p className="hint pad">{t('editor.stepsHint')}</p>
      <ol className="steps">
        {task.steps.map((s, i) => {
          const m = media.find((x) => x.id === s.mediaId);
          return (
            <li key={s.id} className={`card step ${s.enabled ? '' : 'excluded'}`}>
              <div className="step-head">
                <span className="step-num">{i + 1}</span>
                <input
                  className="step-title"
                  value={s.title}
                  placeholder={t('editor.stepTitle')}
                  onChange={(e) => patchStep(s.id, { title: e.target.value })}
                />
                <div className="step-tools">
                  <button className="icon-btn" onClick={() => moveStep(i, -1)} aria-label={t('editor.up')} disabled={i === 0}>
                    <Icon name="up" size={18} />
                  </button>
                  <button className="icon-btn" onClick={() => moveStep(i, 1)} aria-label={t('editor.down')} disabled={i === task.steps.length - 1}>
                    <Icon name="down" size={18} />
                  </button>
                  <button className="icon-btn" onClick={() => removeStep(s.id)} aria-label={t('common.delete')}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </div>

              {s.type === 'media' && (
                <div className="step-src">
                  <span>
                    {m ? (
                      <>
                        <Icon name={KIND_ICON[m.kind]} size={18} /> {m.title}
                      </>
                    ) : (
                      t('editor.noMedia')
                    )}
                  </span>
                  <button className="btn small ghost" onClick={() => setPicker({ stepId: s.id })}>
                    {t('editor.change')}
                  </button>
                </div>
              )}
              {s.type === 'text' && (
                <div className="step-text">
                  <textarea rows={3} value={s.text ?? ''} placeholder={t('editor.textPlaceholder')} onChange={(e) => patchStep(s.id, { text: e.target.value })} />
                  <DictateButton value={s.text ?? ''} onChange={(v) => patchStep(s.id, { text: v })} />
                </div>
              )}
              {s.type === 'note' && (
                <select value={s.noteId ?? ''} onChange={(e) => patchStep(s.id, { noteId: e.target.value })}>
                  <option value="">{t('editor.pickNote')}</option>
                  {notes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
                </select>
              )}

              <div className="step-nums">
                <label>
                  {t('editor.repeat')}
                  <Stepper value={s.repeat} onChange={(v) => patchStep(s.id, { repeat: v })} min={1} max={99} />
                </label>
                <label>
                  {t('editor.points')}
                  <Stepper value={s.points} onChange={(v) => patchStep(s.id, { points: v })} min={0} max={999} />
                </label>
              </div>
              <Toggle checked={s.enabled} onChange={(v) => patchStep(s.id, { enabled: v })} label={s.enabled ? t('editor.included') : t('editor.excluded')} />
            </li>
          );
        })}
      </ol>
      <div className="add-step">
        <button className="btn" onClick={() => setPicker({})}>
          <Icon name="video" size={18} /> {t('editor.addMedia')}
        </button>
        <button className="btn" onClick={() => patch({ steps: [...task.steps, newStep('text')] })}>
          <Icon name="text" size={18} /> {t('editor.addText')}
        </button>
        <button className="btn" onClick={() => patch({ steps: [...task.steps, newStep('note')] })}>
          <Icon name="note" size={18} /> {t('editor.addNote')}
        </button>
      </div>

      <h2 className="section-title">{t('editor.schedule')}</h2>
      {tipVisible(guide, 'schedule') && <Tip onClose={() => hideTip('schedule')}>{t('tip.schedule')}</Tip>}
      <section className="card form">
        <Toggle checked={task.schedule.enabled} onChange={(v) => patchSchedule({ enabled: v })} label={t('editor.scheduleOn')} />
        {task.schedule.enabled && (
          <>
            <div className="days">
              {WEEK_ORDER.map((d) => (
                <button key={d} className={`day ${task.schedule.days.includes(d) ? 'on' : ''}`} onClick={() => toggleDay(d)} aria-pressed={task.schedule.days.includes(d)}>
                  {t(DAY_KEYS[d]).slice(0, 2)}
                </button>
              ))}
            </div>
            <div className="times">
              <span className="label">{t('editor.times')}</span>
              {task.schedule.times.map((tm, i) => (
                <span key={i} className="time-item">
                  <input
                    type="time"
                    value={tm}
                    onChange={(e) => patchSchedule({ times: task.schedule.times.map((x, j) => (j === i ? e.target.value : x)) })}
                  />
                  <button className="icon-btn" aria-label={t('common.delete')} onClick={() => patchSchedule({ times: task.schedule.times.filter((_, j) => j !== i) })}>
                    <Icon name="close" size={16} />
                  </button>
                </span>
              ))}
              <button className="btn small ghost" onClick={() => patchSchedule({ times: [...task.schedule.times, '12:00'] })}>
                <Icon name="plus" size={16} /> {t('editor.addTime')}
              </button>
            </div>
            <p className="hint">{t('editor.timesHint')}</p>
            <label>
              {t('editor.remindEvery')}
              <select value={task.schedule.remindEveryMin} onChange={(e) => patchSchedule({ remindEveryMin: parseInt(e.target.value, 10) })}>
                <option value={0}>{t('editor.remindOff')}</option>
                {[15, 30, 60, 90, 120, 180].map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? t('snooze.min', { n: m }) : t('editor.hours', { n: m / 60 })}
                  </option>
                ))}
              </select>
            </label>
            {task.schedule.remindEveryMin > 0 && (
              <label>
                {t('editor.remindUntil')}
                <input type="time" value={task.schedule.remindUntil} onChange={(e) => patchSchedule({ remindUntil: e.target.value })} />
              </label>
            )}
          </>
        )}
      </section>

      {id && (
        <>
          <h2 className="section-title">{t('manage.title')}</h2>
          <div className="manage-row">
            <button className="btn" onClick={duplicate}>
              <Icon name="copy" size={18} /> {t('manage.duplicate')}
            </button>
            <button className="btn" onClick={() => openMenu('share')}>
              <Icon name="share" size={18} /> {t('manage.share')}
            </button>
            <button className="btn" onClick={() => openMenu('archive')}>
              <Icon name="archive" size={18} /> {t('manage.archive')}
            </button>
            <button className="btn danger" onClick={() => openMenu('delete')}>
              <Icon name="trash" size={18} /> {t('manage.delete')}
            </button>
          </div>
        </>
      )}
      <div className="bottom-space" />

      {picker && (
        <Modal title={t('editor.pickMedia')} onClose={() => setPicker(null)}>
          <MediaPicker onPicked={onPicked} />
        </Modal>
      )}
      {menu && saved && <TaskMenu task={saved} fromEditor initial={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
