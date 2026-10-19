import type { Task } from '../db/types';
import { DAY_KEYS, t, WEEK_ORDER } from '../i18n';

export function scheduleSummary(task: Task): string {
  const s = task.schedule;
  if (!s.enabled || s.times.length === 0 || s.days.length === 0) return t('tasks.noSchedule');
  const days =
    s.days.length === 7
      ? t('tasks.everyDay')
      : WEEK_ORDER.filter((d) => s.days.includes(d))
          .map((d) => t(DAY_KEYS[d]).slice(0, 2))
          .join(' ');
  return `${days}, ${[...s.times].sort().join(', ')}`;
}
