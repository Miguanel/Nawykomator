import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { Header } from '../components/ui';
import { APP_NAME, APP_VERSION, COFFEE_URL } from '../config';
import * as db from '../db/db';
import { getLang, setLang, t, type Lang } from '../i18n';
import { adhocKey } from '../lib/schedule';
import {
  getPermissions,
  lastPlan,
  openExactAlarmSettings,
  registerActions,
  requestDisplayPermission,
  requestReschedule,
  testNotification,
  type PermissionInfo,
} from '../lib/notifications';
import { isNative, openExternal } from '../lib/platform';
import { checkForUpdate } from '../lib/update';

export function CoffeeButton({ className = '' }: { className?: string }) {
  return (
    <button className={`btn coffee ${className}`} onClick={() => openExternal(COFFEE_URL)}>
      <Icon name="cup" size={20} /> {t('more.coffee')}
    </button>
  );
}

const statusLabel = (s: PermissionInfo['display']) =>
  s === 'granted' ? t('more.permGranted') : s === 'unsupported' ? t('more.permWeb') : t('more.permDenied');

export function More() {
  const app = useApp();
  const [perm, setPerm] = useState<PermissionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const lang = getLang();

  const refresh = () => getPermissions().then(setPerm);
  useEffect(() => {
    refresh();
  }, []);

  const changeLang = async (l: Lang) => {
    setLang(l);
    await registerActions();
    requestReschedule();
  };

  const test = async () => {
    const tasks = (await db.getAll('tasks')).filter((x) => !x.archived);
    if (!tasks.length) {
      app.toast(t('more.testNeedTask'));
      return;
    }
    await testNotification(tasks[0].id, adhocKey(new Date()), tasks[0].title);
    app.toast(t('more.testSent'));
  };

  const update = async () => {
    setChecking(true);
    const u = await checkForUpdate(true);
    setChecking(false);
    if (u) openExternal(u.apk);
    else app.toast(t('more.upToDate'));
  };

  return (
    <div className="screen">
      <Header title={t('more.title')} />

      <button className="list-row help-link" onClick={() => app.push({ name: 'help' })}>
        <span className="feature-icon">
          <Icon name="compass" size={22} />
        </span>
        <span className="list-main">
          <strong>{t('more.guide')}</strong>
          <small>{t('more.guideText')}</small>
        </span>
        <Icon name="chevron" size={20} className="chev" />
      </button>

      <h2 className="section-title">{t('more.language')}</h2>
      <div className="card">
        <div className="seg">
          <button className={lang === 'pl' ? 'on' : ''} onClick={() => changeLang('pl')}>
            Polski
          </button>
          <button className={lang === 'szl' ? 'on' : ''} onClick={() => changeLang('szl')}>
            Ślōnskŏ gŏdka
          </button>
        </div>
      </div>

      <h2 className="section-title">{t('more.notifications')}</h2>
      <div className="card form">
        {perm && (
          <>
            <p className="perm-row">
              <span>{t('more.permDisplay')}</span>
              <strong className={perm.display === 'granted' ? 'ok-text' : 'warn-text'}>{statusLabel(perm.display)}</strong>
            </p>
            {isNative() && perm.display !== 'granted' && (
              <button className="btn primary" onClick={async () => { await requestDisplayPermission(); refresh(); }}>
                {t('more.allow')}
              </button>
            )}
            {isNative() && (
              <>
                <p className="perm-row">
                  <span>{t('more.permExact')}</span>
                  <strong className={perm.exact === 'granted' ? 'ok-text' : 'warn-text'}>{statusLabel(perm.exact)}</strong>
                </p>
                {perm.exact !== 'granted' && (
                  <button className="btn" onClick={async () => { await openExactAlarmSettings(); refresh(); }}>
                    {t('more.openExact')}
                  </button>
                )}
              </>
            )}
          </>
        )}
        <button className="btn" onClick={test}>
          <Icon name="bell" size={18} /> {t('more.test')}
        </button>
        <p className="hint">{t('more.planned', { n: lastPlan.length })}</p>
        <details>
          <summary>{t('more.batteryTitle')}</summary>
          <p className="hint">{t('more.batteryText')}</p>
        </details>
      </div>

      <h2 className="section-title">{t('more.support')}</h2>
      <div className="card form center">
        <p>{t('more.coffeeText')}</p>
        <CoffeeButton className="wide" />
      </div>

      <h2 className="section-title">{t('more.about')}</h2>
      <div className="card form">
        <p>
          <strong>{APP_NAME}</strong> {t('more.version', { v: APP_VERSION })}
        </p>
        <p className="hint">{t('more.aboutText')}</p>
        {isNative() && (
          <button className="btn" onClick={update} disabled={checking}>
            {checking ? '…' : t('more.checkUpdate')}
          </button>
        )}
      </div>
      <div className="bottom-space" />
    </div>
  );
}
