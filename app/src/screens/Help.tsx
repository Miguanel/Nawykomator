// "Jak to działa" – krótka instrukcja wszystkich funkcji (Więcej → Przewodnik i pomoc).
import { useApp } from '../app-context';
import { Icon, type IconName } from '../components/Icon';
import { Header, Toggle } from '../components/ui';
import { t, type TKey } from '../i18n';
import { updateGuide, useGuide } from '../lib/guide';

const SECTIONS: [IconName, TKey, TKey][] = [
  ['tasks', 'help.tasks', 'help.tasksText'],
  ['loop', 'help.sources', 'help.sourcesText'],
  ['bell', 'help.reminders', 'help.remindersText'],
  ['play', 'help.run', 'help.runText'],
  ['check', 'help.done', 'help.doneText'],
  ['clock', 'help.snooze', 'help.snoozeText'],
  ['note', 'help.notes', 'help.notesText'],
  ['stats', 'help.stats', 'help.statsText'],
];

export function Help() {
  const app = useApp();
  const g = useGuide();
  return (
    <div className="screen">
      <Header title={t('help.title')} onBack={app.back} />
      <div className="card form">
        <Toggle checked={!g.state.hidden} onChange={(v) => updateGuide({ hidden: !v, tipsHidden: v ? [] : g.state.tipsHidden })} label={t('help.showGuide')} />
        <button className="btn" onClick={() => app.push({ name: 'welcome' })}>
          {t('help.replayWelcome')}
        </button>
      </div>
      <div className="help-list">
        {SECTIONS.map(([icon, title, text]) => (
          <section key={title} className="help-item">
            <span className="feature-icon">
              <Icon name={icon} size={22} />
            </span>
            <div>
              <h2>{t(title)}</h2>
              <p>{t(text)}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="bottom-space" />
    </div>
  );
}
