import { App as CapApp } from '@capacitor/app';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppContext, type AppApi, type DonePreset, type Route, type TabName } from './app-context';
import { DoneModal, SnoozeModal } from './components/TaskModals';
import { Modal, NavIcon } from './components/ui';
import * as db from './db/db';
import type { RunProgress, Task } from './db/types';
import { t, useLang } from './i18n';
import { enabledSteps } from './lib/actions';
import {
  initNotifications,
  requestReschedule,
  setNotificationHandler,
  setWebNotificationListener,
  type NotifPayload,
} from './lib/notifications';
import { isNative } from './lib/platform';
import { hhmm } from './lib/util';
import { More } from './screens/More';
import { NoteEditor } from './screens/NoteEditor';
import { NotePlay } from './screens/NotePlay';
import { Notes } from './screens/Notes';
import { Runner } from './screens/Runner';
import { Stats } from './screens/Stats';
import { TaskEditor } from './screens/TaskEditor';
import { Tasks } from './screens/Tasks';
import { Today } from './screens/Today';

const TABS: TabName[] = ['today', 'tasks', 'notes', 'stats', 'more'];

type ModalState =
  | { kind: 'done'; task: Task; slotKey: string; mode: 'manual' | 'guided'; preset?: DonePreset }
  | { kind: 'snooze'; task: Task; slotKey: string }
  | { kind: 'resume'; task: Task; slotKey: string; progress: RunProgress }
  | { kind: 'notif'; task: Task; slotKey: string; body?: string }
  | null;

export default function App() {
  useLang(); // przerysuj wszystko po zmianie języka
  const [stack, setStack] = useState<Route[]>([{ name: 'today' }]);
  const [modal, setModal] = useState<ModalState>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const backGuard = useRef<(() => boolean) | null>(null);
  const toastTimer = useRef<number | null>(null);
  const route = stack[stack.length - 1];

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const push = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), r]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const tab = useCallback((name: TabName) => setStack([{ name }]), []);

  const runTask = useCallback(async (task: Task, slotKey: string) => {
    const progress = await db.get('progress', task.id);
    if (progress && progress.stepIndex < enabledSteps(task).length) {
      setModal({ kind: 'resume', task, slotKey: progress.slotKey || slotKey, progress });
    } else {
      setModal(null);
      setStack((s) => [...s.filter((r) => r.name !== 'run'), { name: 'run', taskId: task.id, slotKey }]);
    }
  }, []);

  const api: AppApi = useMemo(
    () => ({
      route,
      push,
      replace,
      back,
      tab,
      toast,
      runTask,
      openDone: (task, slotKey, mode, preset) => setModal({ kind: 'done', task, slotKey, mode, preset }),
      openSnooze: (task, slotKey) => setModal({ kind: 'snooze', task, slotKey }),
      setBackGuard: (fn) => {
        backGuard.current = fn;
      },
    }),
    [route, push, replace, back, tab, toast, runTask],
  );

  // --- powiadomienia ---
  useEffect(() => {
    const withTask = async (p: NotifPayload, fn: (task: Task) => void) => {
      const task = await db.get('tasks', p.taskId);
      if (task && !task.archived) fn(task);
    };
    setNotificationHandler((action, p) => {
      withTask(p, (task) => {
        if (action === 'run') runTask(task, p.slotKey);
        else if (action === 'done') setModal({ kind: 'done', task, slotKey: p.slotKey, mode: 'manual' });
        else if (action === 'snooze') setModal({ kind: 'snooze', task, slotKey: p.slotKey });
        else setModal({ kind: 'notif', task, slotKey: p.slotKey });
      });
    });
    setWebNotificationListener((_title, body, p) => {
      withTask(p, (task) => setModal({ kind: 'notif', task, slotKey: p.slotKey, body }));
    });
    initNotifications().then(requestReschedule);
  }, [runTask]);

  // --- cykl życia apki i przycisk "wstecz" ---
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const stackRef = useRef(stack);
  stackRef.current = stack;
  useEffect(() => {
    if (!isNative()) return;
    const subs = [
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) requestReschedule();
      }),
      CapApp.addListener('backButton', () => {
        if (modalRef.current) return setModal(null);
        if (backGuard.current?.()) return;
        const s = stackRef.current;
        if (s.length > 1) return back();
        if (s[0].name !== 'today') return tab('today');
        CapApp.minimizeApp();
      }),
    ];
    return () => {
      subs.forEach((p) => p.then((h) => h.remove()));
    };
  }, [back, tab]);

  const isTab = TABS.includes(route.name as TabName);
  const rootTab = stack[0].name as TabName;

  let screen: ReactNode;
  switch (route.name) {
    case 'today':
      screen = <Today />;
      break;
    case 'tasks':
      screen = <Tasks />;
      break;
    case 'notes':
      screen = <Notes />;
      break;
    case 'stats':
      screen = <Stats />;
      break;
    case 'more':
      screen = <More />;
      break;
    case 'task-edit':
      screen = <TaskEditor key={route.id ?? 'new'} id={route.id} />;
      break;
    case 'run':
      screen = <Runner key={`${route.taskId}-${route.resume ? 'r' : 'n'}`} taskId={route.taskId} slotKey={route.slotKey} resume={route.resume} />;
      break;
    case 'note-edit':
      screen = <NoteEditor key={route.id ?? 'new'} id={route.id} />;
      break;
    case 'note-play':
      screen = <NotePlay id={route.id} learn={route.learn} />;
      break;
  }

  const startRun = (task: Task, slotKey: string, resume: boolean) => {
    setModal(null);
    setStack((s) => [...s.filter((r) => r.name !== 'run'), { name: 'run', taskId: task.id, slotKey, resume }]);
  };

  return (
    <AppContext.Provider value={api}>
      <div className={`app ${route.name === 'run' ? 'immersive' : ''}`}>
        <main className="main">{screen}</main>

        {isTab && (
          <nav className="tabbar" aria-label="Nawigacja">
            {TABS.map((name) => (
              <button key={name} className={rootTab === name ? 'on' : ''} onClick={() => tab(name)} aria-current={rootTab === name ? 'page' : undefined}>
                <NavIcon name={name} />
                <span>{t(`nav.${name}` as 'nav.today')}</span>
              </button>
            ))}
          </nav>
        )}

        {modal?.kind === 'done' && (
          <DoneModal
            task={modal.task}
            slotKey={modal.slotKey}
            mode={modal.mode}
            preset={modal.preset}
            onClose={() => setModal(null)}
            onDone={(pts) => {
              setModal(null);
              toast(t('done.toast', { n: pts }));
              if (stackRef.current[stackRef.current.length - 1].name === 'run') back();
            }}
          />
        )}
        {modal?.kind === 'snooze' && (
          <SnoozeModal
            task={modal.task}
            slotKey={modal.slotKey}
            onClose={() => setModal(null)}
            onSnoozed={(at) => {
              setModal(null);
              toast(t('snooze.toast', { time: hhmm(at) }));
            }}
          />
        )}
        {modal?.kind === 'resume' && (
          <Modal title={t('resume.title')} onClose={() => setModal(null)}>
            <p className="modal-task">
              <span className="dot" style={{ background: modal.task.color }} /> {modal.task.title}
            </p>
            <p>{t('resume.text', { n: modal.progress.stepIndex + 1, total: enabledSteps(modal.task).length })}</p>
            <div className="stack-btns">
              <button className="btn primary big" onClick={() => startRun(modal.task, modal.slotKey, true)}>
                ↻ {t('resume.continue', { n: modal.progress.stepIndex + 1 })}
              </button>
              <button
                className="btn ghost"
                onClick={async () => {
                  await db.del('progress', modal.task.id);
                  startRun(modal.task, modal.slotKey, false);
                }}
              >
                {t('resume.restart')}
              </button>
            </div>
          </Modal>
        )}
        {modal?.kind === 'notif' && (
          <Modal title={modal.task.title} onClose={() => setModal(null)}>
            <p>{modal.body ?? t('notif.bodyNag')}</p>
            <div className="stack-btns">
              <button className="btn primary big" onClick={() => runTask(modal.task, modal.slotKey)}>
                ▶ {t('action.run')}
              </button>
              <button className="btn ok big" onClick={() => setModal({ kind: 'done', task: modal.task, slotKey: modal.slotKey, mode: 'manual' })}>
                ✓ {t('action.done')}
              </button>
              <button className="btn ghost" onClick={() => setModal({ kind: 'snooze', task: modal.task, slotKey: modal.slotKey })}>
                {t('action.snooze')}
              </button>
            </div>
          </Modal>
        )}

        {toastMsg && (
          <div className="toast" role="status">
            {toastMsg}
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
