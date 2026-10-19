// "Wykonaj teraz" – prowadzi przez procedurę krok po kroku, tyle razy, ile user ustawił.
import { hideTip, tipVisible, useGuide } from '../lib/guide';
import { Icon } from '../components/Icon';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { detectsEnd, MediaPlayer } from '../components/MediaPlayer';
import { NoteSequence } from '../components/NotePlayer';
import { Modal, Tip } from '../components/ui';
import * as db from '../db/db';
import type { MediaItem, Note, RunProgress, Task } from '../db/types';
import { t } from '../i18n';
import { enabledSteps, interruptRun, RESUME_AFTER_MIN } from '../lib/actions';
import { keepAwake } from '../lib/platform';

export function Runner({ taskId, slotKey, resume }: { taskId: string; slotKey: string; resume?: boolean }) {
  const app = useApp();
  const [task, setTask] = useState<Task | null>(null);
  const [mediaMap, setMediaMap] = useState<Map<string, MediaItem>>(new Map());
  const [notes, setNotes] = useState<Map<string, Note>>(new Map());
  const [stepIndex, setStepIndex] = useState(0);
  const [rep, setRep] = useState(0);
  const [reps, setReps] = useState<Record<string, number>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [playToken, setPlayToken] = useState(0);
  const [finished, setFinished] = useState(false);
  const [stepDone, setStepDone] = useState(false);
  const [askStop, setAskStop] = useState(false);
  const advanceTimer = useRef<number | null>(null);
  const guide = useGuide();

  useEffect(() => {
    (async () => {
      const [tk, media, ns, prog] = await Promise.all([
        db.get('tasks', taskId),
        db.getAll('media'),
        db.getAll('notes'),
        db.get('progress', taskId),
      ]);
      setMediaMap(new Map(media.map((m) => [m.id, m])));
      setNotes(new Map(ns.map((n) => [n.id, n])));
      if (resume && prog) {
        setStepIndex(prog.stepIndex);
        setRep(prog.rep);
        setReps(prog.reps);
        setSkipped(prog.skipped);
      } else if (prog) {
        await db.del('progress', taskId);
      }
      setTask(tk ?? null);
    })();
    keepAwake(true);
    return () => {
      keepAwake(false);
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    };
  }, [taskId, resume]);

  const steps = task ? enabledSteps(task) : [];
  const step = steps[stepIndex];
  const started = stepIndex > 0 || rep > 0 || Object.keys(reps).length > 0;

  // zapisuj postęp na bieżąco (gdyby system ubił apkę)
  useEffect(() => {
    if (!task || finished || !started) return;
    const p: RunProgress = { taskId, slotKey, stepIndex, rep, reps, skipped, updatedAt: Date.now() };
    db.put('progress', p);
  }, [task, taskId, slotKey, stepIndex, rep, reps, skipped, finished, started]);

  const goTo = useCallback(
    (i: number) => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      setStepDone(false);
      if (i >= steps.length) {
        setFinished(true);
        return;
      }
      setStepIndex(Math.max(0, i));
      setRep(reps[steps[Math.max(0, i)]?.id] ?? 0);
      setPlayToken((x) => x + 1);
    },
    [steps, reps],
  );

  const finishNow = () => {
    if (!task) return;
    const checked = steps.filter((s) => (reps[s.id] ?? 0) >= s.repeat && !skipped.includes(s.id)).map((s) => s.id);
    app.openDone(task, slotKey, 'guided', { checked, reps });
  };

  useEffect(() => {
    if (finished) finishNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const countRep = () => {
    if (!step || stepDone) return;
    const n = rep + 1;
    setRep(n);
    setReps((r) => ({ ...r, [step.id]: n }));
    if (n < step.repeat) {
      setPlayToken((x) => x + 1);
    } else {
      setStepDone(true);
      setSkipped((s) => s.filter((x) => x !== step.id));
      advanceTimer.current = window.setTimeout(() => goTo(stepIndex + 1), 1400);
    }
  };

  const skip = () => {
    if (!step) return;
    setSkipped((s) => (s.includes(step.id) ? s : [...s, step.id]));
    goTo(stepIndex + 1);
  };

  const close = () => {
    if (!started) {
      app.back();
      return;
    }
    setAskStop(true);
  };

  const confirmStop = async () => {
    if (!task) return;
    await interruptRun(task, { taskId, slotKey, stepIndex, rep, reps, skipped, updatedAt: Date.now() });
    app.toast(t('run.interruptedToast', { n: RESUME_AFTER_MIN }));
    app.back();
  };

  // przycisk "wstecz" Androida
  useEffect(() => {
    app.setBackGuard(() => {
      close();
      return true;
    });
    return () => app.setBackGuard(null);
  });

  if (!task) return <div className="screen" />;
  if (steps.length === 0)
    return (
      <div className="screen">
        <p className="muted center">{t('run.noSteps')}</p>
        <button className="btn wide" onClick={app.back}>
          {t('common.back')}
        </button>
      </div>
    );

  const media = step?.mediaId ? mediaMap.get(step.mediaId) : undefined;
  const note = step?.noteId ? notes.get(step.noteId) : undefined;

  return (
    <div className="screen runner">
      <header className="runner-head">
        <button className="icon-btn" onClick={close} aria-label={t('common.close')}>
          <Icon name="close" size={22} />
        </button>
        <div className="runner-title">
          <small>{task.title}</small>
          <strong>
            {finished ? t('run.finished') : t('run.stepOf', { n: stepIndex + 1, total: steps.length })}
          </strong>
        </div>
        <span />
      </header>
      <div className="runner-steps" aria-hidden="true">
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={`seg-dot ${i === stepIndex && !finished ? 'cur' : ''} ${(reps[s.id] ?? 0) >= s.repeat ? 'done' : ''} ${skipped.includes(s.id) ? 'skip' : ''}`}
          />
        ))}
      </div>

      {finished ? (
        <div className="runner-finish">
          <div className="big-check">
            <Icon name="check" size={44} />
          </div>
          <p>{t('run.finishedHint')}</p>
          <button className="btn primary wide" onClick={finishNow}>
            <Icon name="check" size={18} /> {t('action.done')}
          </button>
          <button className="btn ghost wide" onClick={() => goTo(0)}>
            {t('run.again')}
          </button>
        </div>
      ) : (
        step && (
          <section className="runner-body">
            {tipVisible(guide, 'runner') && <Tip onClose={() => hideTip('runner')}>{t('tip.runner')}</Tip>}
            <h2>{step.title}</h2>
            <div className="rep-counter" aria-live="polite">
              <span className={stepDone ? 'ok' : ''}>
                {stepDone ? <Icon name="check" size={34} /> : null}
                {rep}/{step.repeat}
              </span>
              <small>{t('run.reps')}</small>
            </div>

            {step.type === 'media' &&
              (media ? (
                <MediaPlayer key={`${step.id}`} media={media} playToken={playToken} autoPlay onEnded={countRep} />
              ) : (
                <p className="muted">{t('run.noMedia')}</p>
              ))}
            {step.type === 'text' && <div className="run-text">{step.text}</div>}
            {step.type === 'note' &&
              (note ? <NoteSequence key={step.id} note={note} playToken={playToken} onFinished={countRep} /> : <p className="muted">{t('run.noNote')}</p>)}

            {step.type === 'media' && media && !detectsEnd(media) && <p className="hint">{t('run.manualHint')}</p>}

            <div className="runner-actions">
              <button className="btn primary big" onClick={countRep} disabled={stepDone}>
                {step.type === 'text' ? (
                  <>
                    <Icon name="check" size={20} /> {t('run.didOnce')}
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={20} /> {t('run.countRep')}
                  </>
                )}
              </button>
              <div className="row">
                <button className="btn ghost" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}>
                  <Icon name="back" size={18} /> {t('run.prev')}
                </button>
                <button className="btn ghost" onClick={skip}>
                  {t('run.skip')} <Icon name="skip" size={16} />
                </button>
              </div>
            </div>
          </section>
        )
      )}

      {askStop && (
        <Modal
          title={t('run.stopQ')}
          onClose={() => setAskStop(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setAskStop(false)}>
                {t('run.continue')}
              </button>
              <button className="btn danger" onClick={confirmStop}>
                {t('run.stop')}
              </button>
            </>
          }
        >
          <p>{t('run.stopHint', { n: RESUME_AFTER_MIN })}</p>
        </Modal>
      )}
    </div>
  );
}
