// Lista "Pierwsze kroki" na ekranie Dziś. Punkty odhaczają się same, gdy user coś zrobi.
import { useState } from 'react';
import { useApp } from '../app-context';
import * as db from '../db/db';
import { t } from '../i18n';
import { updateGuide, useGuide, type GuideItemId } from '../lib/guide';
import { Icon } from './Icon';

export function GuideCard() {
  const app = useApp();
  const g = useGuide();
  const [open, setOpen] = useState<GuideItemId | 'none' | null>(null);
  if (!g.ready || g.state.hidden || !g.state.onboarded) return null;
  const total = g.items.length;
  const allDone = g.doneCount === total;

  const go = async (id: GuideItemId) => {
    const tasks = (await db.getAll('tasks')).filter((x) => !x.archived);
    switch (id) {
      case 'task':
        app.push({ name: 'task-edit' });
        break;
      case 'media':
      case 'schedule':
        app.push({ name: 'task-edit', id: tasks[0]?.id });
        break;
      case 'run':
      case 'snooze':
        app.toast(t(id === 'run' ? 'guide.hintRun' : 'guide.hintSnooze'));
        break;
      case 'voice':
        app.tab('notes');
        app.push({ name: 'note-edit' });
        break;
      case 'stats':
        app.tab('stats');
        break;
    }
  };

  const next = g.items.find((i) => !i.done);

  return (
    <section className="guide-card" aria-label={t('guide.title')}>
      <div className="guide-head">
        <div>
          <h2>{allDone ? t('guide.doneTitle') : t('guide.title')}</h2>
          <p className="muted">{allDone ? t('guide.doneText') : t('guide.progress', { n: g.doneCount, total })}</p>
        </div>
        <button className="btn small ghost" onClick={() => updateGuide({ hidden: true })}>
          {t('guide.hide')}
        </button>
      </div>
      <div className="guide-bar" aria-hidden="true">
        <span style={{ width: `${(g.doneCount / total) * 100}%` }} />
      </div>
      <ul className="guide-list">
        {g.items.map((item) => {
          const expanded = open === item.id || (open === null && next?.id === item.id);
          return (
            <li key={item.id} className={item.done ? 'done' : ''}>
              <button className="guide-item" onClick={() => setOpen(expanded ? 'none' : item.id)} aria-expanded={expanded}>
                <span className="guide-check">{item.done && <Icon name="check" size={16} />}</span>
                <span className="guide-title">{t(item.title)}</span>
              </button>
              {expanded && !item.done && (
                <div className="guide-detail">
                  <p>{t(item.text)}</p>
                  <button className="btn small primary" onClick={() => go(item.id)}>
                    {t('guide.show')}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
