// Ekran powitalny przy pierwszym uruchomieniu (można go też otworzyć z "Więcej → Przewodnik").
import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { Icon, type IconName } from '../components/Icon';
import { getLang, setLang, t, type TKey } from '../i18n';
import { createSampleTask, updateGuide } from '../lib/guide';
import { getPermissions, openExactAlarmSettings, registerActions, requestDisplayPermission, type PermissionInfo } from '../lib/notifications';
import { isNative } from '../lib/platform';

const FEATURES: [IconName, TKey, TKey][] = [
  ['loop', 'welcome.f1', 'welcome.f1t'],
  ['bell', 'welcome.f2', 'welcome.f2t'],
  ['leaf', 'welcome.f3', 'welcome.f3t'],
];

const FLOW: [IconName, TKey][] = [
  ['tasks', 'welcome.flow1'],
  ['play', 'welcome.flow2'],
  ['check', 'welcome.flow3'],
  ['stats', 'welcome.flow4'],
];

export function Welcome() {
  const app = useApp();
  const [page, setPage] = useState(0);
  const [lang, setL] = useState(getLang());
  const [perm, setPerm] = useState<PermissionInfo | null>(null);
  const pages = 4;

  useEffect(() => {
    getPermissions().then(setPerm);
  }, [page]);

  const finish = async (next: 'guided' | 'sample' | 'skip') => {
    await updateGuide({ onboarded: true, hidden: false });
    if (next === 'sample') {
      await createSampleTask();
      app.tab('today');
      app.toast(t('welcome.sampleAdded'));
    } else if (next === 'guided') {
      app.tab('today');
      app.push({ name: 'task-edit' });
    } else {
      app.tab('today');
    }
  };

  const changeLang = async (l: 'pl' | 'szl') => {
    setLang(l);
    setL(l);
    await registerActions();
  };

  return (
    <div className="welcome">
      <div className="welcome-plank">
        <img src="./icon.svg" alt="" width={56} height={56} />
        <span>Nawykomator</span>
      </div>

      <div className="welcome-body" key={page}>
        {page === 0 && (
          <>
            <h1>{t('welcome.title')}</h1>
            <p className="lead">{t('welcome.lead')}</p>
            <ul className="feature-list">
              {FEATURES.map(([icon, title, text]) => (
                <li key={title}>
                  <span className="feature-icon">
                    <Icon name={icon} size={22} />
                  </span>
                  <span>
                    <strong>{t(title)}</strong>
                    <span className="muted">{t(text)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="seg">
              <button className={lang === 'pl' ? 'on' : ''} onClick={() => changeLang('pl')}>
                Polski
              </button>
              <button className={lang === 'szl' ? 'on' : ''} onClick={() => changeLang('szl')}>
                Ślōnskŏ gŏdka
              </button>
            </div>
          </>
        )}

        {page === 1 && (
          <>
            <h1>{t('welcome.howTitle')}</h1>
            <ol className="flow">
              {FLOW.map(([icon, text], i) => (
                <li key={text}>
                  <span className="flow-num">{i + 1}</span>
                  <Icon name={icon} size={22} className="flow-icon" />
                  <span>{t(text)}</span>
                </li>
              ))}
            </ol>
            <p className="muted">{t('welcome.howNote')}</p>
          </>
        )}

        {page === 2 && (
          <>
            <h1>{t('welcome.notifTitle')}</h1>
            <p className="lead">{t('welcome.notifLead')}</p>
            {isNative() ? (
              <div className="perm-steps">
                <div className="perm-step">
                  <span>{t('more.permDisplay')}</span>
                  {perm?.display === 'granted' ? (
                    <strong className="ok-text">
                      <Icon name="check" size={18} /> {t('more.permGranted')}
                    </strong>
                  ) : (
                    <button className="btn primary small" onClick={async () => { await requestDisplayPermission(); setPerm(await getPermissions()); }}>
                      {t('more.allow')}
                    </button>
                  )}
                </div>
                <div className="perm-step">
                  <span>{t('more.permExact')}</span>
                  {perm?.exact === 'granted' ? (
                    <strong className="ok-text">
                      <Icon name="check" size={18} /> {t('more.permGranted')}
                    </strong>
                  ) : (
                    <button className="btn small" onClick={async () => { await openExactAlarmSettings(); setPerm(await getPermissions()); }}>
                      {t('welcome.openSettings')}
                    </button>
                  )}
                </div>
                <p className="hint">{t('more.batteryText')}</p>
              </div>
            ) : (
              <p className="muted">{t('welcome.notifWeb')}</p>
            )}
          </>
        )}

        {page === 3 && (
          <>
            <h1>{t('welcome.startTitle')}</h1>
            <p className="lead">{t('welcome.startLead')}</p>
            <div className="choice-list">
              <button className="choice" onClick={() => finish('guided')}>
                <Icon name="compass" size={26} />
                <span>
                  <strong>{t('welcome.optGuided')}</strong>
                  <span>{t('welcome.optGuidedText')}</span>
                </span>
              </button>
              <button className="choice" onClick={() => finish('sample')}>
                <Icon name="sprout" size={26} />
                <span>
                  <strong>{t('welcome.optSample')}</strong>
                  <span>{t('welcome.optSampleText')}</span>
                </span>
              </button>
              <button className="btn ghost wide" onClick={() => finish('skip')}>
                {t('welcome.optSkip')}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="welcome-foot">
        <div className="dots" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <span key={i} className={i === page ? 'on' : ''} />
          ))}
        </div>
        <div className="row">
          {page > 0 && (
            <button className="btn ghost" onClick={() => setPage(page - 1)}>
              {t('common.back')}
            </button>
          )}
          {page < pages - 1 && (
            <button className="btn primary" onClick={() => setPage(page + 1)}>
              {t('common.next')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
