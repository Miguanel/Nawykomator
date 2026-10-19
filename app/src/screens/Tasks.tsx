import { Icon } from '../components/Icon';
import { useApp } from '../app-context';
import { Empty, Header } from '../components/ui';
import * as db from '../db/db';
import type { Task } from '../db/types';
import { DAY_KEYS, t, tn, WEEK_ORDER } from '../i18n';
import { useLive } from '../lib/hooks';

export function scheduleSummary(task: Task): string {
  const s = task.schedule;
  if (!s.enabled || s.times.length === 0 || s.days.length === 0) return t('tasks.noSchedule');
  const days =
    s.days.length === 7
      ? t('tasks.everyDay')
      : WEEK_ORDER.filter((d) => s.days.includes(d))
          .map((d) => t(DAY_KEYS[d]).slice(0, 2))
          .join(' ');
  return `${days} · ${[...s.times].sort().join(', ')}`;
}

export function Tasks() {
  const app = useApp();
  const tasks = useLive(() => db.getAll('tasks'), [], []);
  const active = tasks.filter((x) => !x.archived).sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  const groups = new Map<string, Task[]>();
  for (const task of active) {
    const k = task.category || t('tasks.noCategory');
    groups.set(k, [...(groups.get(k) ?? []), task]);
  }

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
      {active.length === 0 && <Empty icon="tasks" text={t('tasks.empty')} />}
      {[...groups.entries()].map(([cat, list]) => (
        <section key={cat}>
          <h2 className="section-title">{cat}</h2>
          <ul className="list">
            {list.map((task) => (
              <li key={task.id}>
                <button className="list-row" onClick={() => app.push({ name: 'task-edit', id: task.id })}>
                  <span className="dot big" style={{ background: task.color }} />
                  <span className="list-main">
                    <strong>{task.title}</strong>
                    <small>
                      {tn('today.steps', task.steps.filter((s) => s.enabled).length)} · {scheduleSummary(task)}
                    </small>
                  </span>
                  <span className="chev">›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
