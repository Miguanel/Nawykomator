import { useRef, useState } from 'react';
import { useApp } from '../app-context';
import { Icon } from '../components/Icon';
import { TaskMenu } from '../components/TaskMenu';
import { Empty, Header } from '../components/ui';
import * as db from '../db/db';
import type { Task } from '../db/types';
import { t, tn } from '../i18n';
import { useLive } from '../lib/hooks';
import { scheduleSummary } from '../lib/scheduleText';
import { readPackageFile } from '../lib/taskShare';

export { scheduleSummary };

export function Tasks() {
  const app = useApp();
  const tasks = useLive(() => db.getAll('tasks'), [], [] as Task[]);
  const [view, setView] = useState<'active' | 'archive'>('active');
  const [menu, setMenu] = useState<Task | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const archived = tasks.filter((x) => x.archived);
  const shown = tasks
    .filter((x) => (view === 'archive' ? x.archived : !x.archived))
    .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  const groups = new Map<string, Task[]>();
  for (const task of shown) {
    const k = task.category || t('tasks.noCategory');
    groups.set(k, [...(groups.get(k) ?? []), task]);
  }

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const task = await readPackageFile(f);
      setView('active');
      app.toast(t('tasks.imported', { title: task.title }));
    } catch {
      app.toast(t('tasks.importError'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="screen">
      <Header
        title={t('tasks.title')}
        right={
          <button className="btn primary small" onClick={() => app.push({ name: 'task-edit' })}>
            <Icon name="plus" size={18} /> {t('tasks.new')}
          </button>
        }
      />

      <div className="seg tasks-seg">
        <button className={view === 'active' ? 'on' : ''} onClick={() => setView('active')}>
          {t('tasks.active')}
        </button>
        <button className={view === 'archive' ? 'on' : ''} onClick={() => setView('archive')}>
          <Icon name="archive" size={18} /> {t('tasks.archive')}
          {archived.length > 0 && <span className="count-badge">{archived.length}</span>}
        </button>
      </div>

      {shown.length === 0 &&
        (view === 'archive' ? <Empty icon="archive" text={t('tasks.archiveEmpty')} /> : <Empty icon="tasks" text={t('tasks.empty')} />)}

      {[...groups.entries()].map(([cat, list]) => (
        <section key={cat}>
          <h2 className="section-title">{cat}</h2>
          <ul className="list">
            {list.map((task) => (
              <li key={task.id}>
                <div className={`list-row ${task.archived ? 'archived' : ''}`}>
                  <button
                    className="list-main as-btn row-main"
                    onClick={() => (task.archived ? setMenu(task) : app.push({ name: 'task-edit', id: task.id }))}
                  >
                    <span className="dot big" style={{ background: task.color }} />
                    <span className="list-main">
                      <strong>{task.title}</strong>
                      <small>
                        {tn('today.steps', task.steps.filter((s) => s.enabled).length)}, {scheduleSummary(task)}
                      </small>
                    </span>
                  </button>
                  <button className="icon-btn" onClick={() => setMenu(task)} aria-label={t('tasks.actions')}>
                    <Icon name="more" size={22} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {view === 'active' && (
        <div className="import-box">
          <button className="btn ghost wide" onClick={() => fileRef.current?.click()}>
            <Icon name="download" size={18} /> {t('tasks.import')}
          </button>
          <p className="hint center">{t('tasks.importHint')}</p>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
      )}
      <div className="bottom-space" />

      {menu && <TaskMenu task={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
