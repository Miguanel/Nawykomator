// Opcje zadania: edytuj, wykonaj, duplikuj, udostępnij, archiwizuj / przywróć, usuń.
import { useState } from 'react';
import { useApp } from '../app-context';
import type { Task } from '../db/types';
import { t } from '../i18n';
import { archiveTask, deleteTaskForever, duplicateTask, restoreTask } from '../lib/actions';
import * as db from '../db/db';
import { currentSlotKey } from '../lib/schedule';
import { startOfDay } from '../lib/util';
import { shareTaskFile, shareTaskText } from '../lib/taskShare';
import { Icon, type IconName } from './Icon';
import { Modal } from './ui';

export type MenuView = 'menu' | 'share' | 'archive' | 'delete';

function isCancel(e: unknown): boolean {
  return /cancel/i.test(String((e as Error)?.message ?? e));
}

export function TaskMenu({
  task,
  onClose,
  fromEditor,
  initial = 'menu',
}: {
  task: Task;
  onClose: () => void;
  fromEditor?: boolean;
  initial?: MenuView;
}) {
  const app = useApp();
  const [view, setView] = useState<MenuView>(initial);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (!isCancel(e)) app.toast(t('share.error'));
    } finally {
      setBusy(false);
    }
  };

  const Item = ({ icon, label, hint, onClick, danger }: { icon: IconName; label: string; hint?: string; onClick: () => void; danger?: boolean }) => (
    <button className={`menu-item ${danger ? 'danger' : ''}`} onClick={onClick} disabled={busy}>
      <Icon name={icon} size={22} />
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </button>
  );

  if (view === 'share')
    return (
      <Modal title={t('share.title')} onClose={onClose}>
        <p className="modal-task">
          <span className="dot" style={{ background: task.color }} /> {task.title}
        </p>
        <div className="menu">
          <Item
            icon="file"
            label={t('share.file')}
            hint={t('share.fileHint')}
            onClick={() =>
              run(async () => {
                const r = await shareTaskFile(task);
                if (r.result === 'downloaded') app.toast(t('share.saved'));
                if (r.blobsSkipped) app.toast(t('share.tooBig'));
                onClose();
              })
            }
          />
          <Item
            icon="text"
            label={t('share.text')}
            hint={t('share.textHint')}
            onClick={() =>
              run(async () => {
                const r = await shareTaskText(task);
                if (r === 'copied') app.toast(t('share.copied'));
                onClose();
              })
            }
          />
        </div>
      </Modal>
    );

  if (view === 'archive' || view === 'delete') {
    const del = view === 'delete';
    return (
      <Modal
        title={del ? t('manage.deleteQ') : t('manage.archiveQ')}
        onClose={onClose}
        footer={
          <>
            <button className="btn ghost" onClick={() => setView('menu')}>
              {t('common.cancel')}
            </button>
            <button
              className={`btn ${del ? 'danger' : 'primary'}`}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (del) await deleteTaskForever(task);
                  else await archiveTask(task);
                  app.toast(del ? t('manage.deleted') : t('manage.archived'));
                  onClose();
                  if (fromEditor) app.back();
                })
              }
            >
              <Icon name={del ? 'trash' : 'archive'} size={18} /> {del ? t('manage.delete') : t('manage.archive')}
            </button>
          </>
        }
      >
        <p className="modal-task">
          <span className="dot" style={{ background: task.color }} /> {task.title}
        </p>
        <p>{del ? t('manage.deleteHint') : t('manage.archiveHint')}</p>
      </Modal>
    );
  }

  return (
    <Modal title={task.title} onClose={onClose}>
      <div className="menu">
        {!fromEditor && !task.archived && (
          <>
            <Item icon="edit" label={t('manage.edit')} onClick={() => { onClose(); app.push({ name: 'task-edit', id: task.id }); }} />
            <Item icon="play" label={t('action.run')} onClick={async () => {
                const now = new Date();
                const from = startOfDay(now).getTime();
                const [events, snoozes] = await Promise.all([db.eventsBetween(from, from + 86_400_000), db.getAll('snoozes')]);
                onClose();
                app.runTask(task, currentSlotKey(task, now, events, snoozes));
              }} />
          </>
        )}
        {task.archived && (
          <Item
            icon="restart"
            label={t('manage.restore')}
            hint={t('manage.restoreHint')}
            onClick={() => run(async () => { await restoreTask(task); app.toast(t('manage.restored')); onClose(); })}
          />
        )}
        <Item
          icon="copy"
          label={t('manage.duplicate')}
          hint={t('manage.duplicateHint')}
          onClick={() =>
            run(async () => {
              const copy = await duplicateTask(task, t('manage.copySuffix'));
              app.toast(t('manage.duplicated'));
              onClose();
              if (fromEditor) app.replace({ name: 'task-edit', id: copy.id });
              else app.push({ name: 'task-edit', id: copy.id });
            })
          }
        />
        <Item icon="share" label={t('manage.share')} hint={t('manage.shareHint')} onClick={() => setView('share')} />
        {!task.archived && <Item icon="archive" label={t('manage.archive')} hint={t('manage.archiveShort')} onClick={() => setView('archive')} />}
        <Item icon="trash" label={t('manage.delete')} danger onClick={() => setView('delete')} />
      </div>
    </Modal>
  );
}
