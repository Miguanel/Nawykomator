import { getGuide, updateGuide } from '../lib/guide';
import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import { useMediaMap } from '../components/NotePlayer';
import { Empty, Header } from '../components/ui';
import * as db from '../db/db';
import type { LogEvent } from '../db/types';
import { t } from '../i18n';
import { useLive } from '../lib/hooks';
import { monthStats, streak, type Row } from '../lib/stats';
import { hhmm } from '../lib/util';

function Bars({ rows, unit }: { rows: Row[]; unit: 'points' | 'count' }) {
  const max = Math.max(1, ...rows.map((r) => r[unit]));
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(r[unit] / max) * 100}%` }} />
          </span>
          <span className="hbar-val">
            {r.points} {t('common.pts')} · {r.count}×
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Stats() {
  useEffect(() => {
    getGuide().then((g) => {
      if (!g.visitedStats) updateGuide({ visitedStats: true });
    });
  }, []);
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const from = new Date(ym.y, ym.m, 1).getTime();
  const to = new Date(ym.y, ym.m + 1, 1).getTime() - 1;
  const events = useLive(() => db.eventsBetween(from, to), [from, to], [] as LogEvent[]);
  const all = useLive(() => db.getAll('events'), [], [] as LogEvent[]);
  const mediaMap = useMediaMap();
  const s = monthStats(events, ym.y, ym.m, (id) => mediaMap.get(id)?.title ?? '—', t('tasks.noCategory'));
  const shift = (d: number) => {
    const x = new Date(ym.y, ym.m + d, 1);
    setYm({ y: x.getFullYear(), m: x.getMonth() });
  };
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const maxDay = Math.max(1, ...s.daily.map((d) => d.points));
  const monthName = new Date(ym.y, ym.m, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });

  return (
    <div className="screen">
      <Header title={t('stats.title')} />
      <div className="month-nav">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label={t('stats.prev')}>
          ‹
        </button>
        <strong>{monthName}</strong>
        <button className="icon-btn" onClick={() => shift(1)} disabled={isCurrent} aria-label={t('stats.next')}>
          ›
        </button>
      </div>

      <div className="kpis">
        <div className="kpi accent">
          <strong>{s.points}</strong>
          <span>{t('stats.points')}</span>
        </div>
        <div className="kpi">
          <strong>{s.done}</strong>
          <span>{t('stats.done')}</span>
        </div>
        <div className="kpi">
          <strong>{s.guided}</strong>
          <span>{t('stats.guided')}</span>
        </div>
        <div className="kpi">
          <strong>{s.manual}</strong>
          <span>{t('stats.manual')}</span>
        </div>
        <div className="kpi">
          <strong>{s.interrupted}</strong>
          <span>{t('stats.interrupted')}</span>
        </div>
        <div className="kpi">
          <strong>{s.snoozed}</strong>
          <span>{t('stats.snoozed')}</span>
        </div>
      </div>

      {s.done === 0 && s.interrupted === 0 ? (
        <Empty icon="stats" text={t('stats.empty')} />
      ) : (
        <>
          <h2 className="section-title">{t('stats.daily')}</h2>
          <div className="card">
            <div className="vbars" role="img" aria-label={t('stats.daily')}>
              {s.daily.map((d) => (
                <div key={d.day} className="vbar" title={`${d.day}: ${d.points} ${t('common.pts')}`}>
                  <span style={{ height: `${(d.points / maxDay) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="vbars-axis">
              <span>1</span>
              <span>{Math.ceil(s.daily.length / 2)}</span>
              <span>{s.daily.length}</span>
            </div>
          </div>

          <h2 className="section-title">{t('stats.byCategory')}</h2>
          <div className="card">
            <Bars rows={s.byCategory} unit="points" />
          </div>

          <h2 className="section-title">{t('stats.byTask')}</h2>
          <div className="card">
            <Bars rows={s.byTask} unit="points" />
            <ul className="streaks">
              {s.byTask.map((r) => {
                const n = streak(all, r.key);
                return n > 1 ? (
                  <li key={r.key}>
                    <Icon name="leaf" size={16} /> {r.label}: {t('stats.streak', { n })}
                  </li>
                ) : null;
              })}
            </ul>
          </div>

          {s.byMedia.length > 0 && (
            <>
              <h2 className="section-title">{t('stats.byMedia')}</h2>
              <div className="card">
                <ul className="hbars">
                  {s.byMedia.map((m) => (
                    <li key={m.mediaId}>
                      <span className="hbar-label">{m.label}</span>
                      <span className="hbar-track">
                        <span className="hbar-fill alt" style={{ width: `${(m.plays / s.byMedia[0].plays) * 100}%` }} />
                      </span>
                      <span className="hbar-val">{t('stats.plays', { n: m.plays })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {s.interruptions.length > 0 && (
            <>
              <h2 className="section-title">{t('stats.whereStopped')}</h2>
              <ul className="list">
                {s.interruptions.slice(0, 15).map((e) => (
                  <li key={e.id} className="list-row static">
                    <span className="list-main">
                      <strong>{e.taskTitle}</strong>
                      <small>
                        {new Date(e.at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} {hhmm(new Date(e.at))} ·{' '}
                        {t('stats.stoppedAt', { n: (e.interrupted?.stepIndex ?? 0) + 1, step: e.interrupted?.stepTitle ?? '' })}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <div className="bottom-space" />
    </div>
  );
}
