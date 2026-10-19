import { Icon } from '../components/Icon';
import { useApp } from '../app-context';
import { Empty, Header } from '../components/ui';
import * as db from '../db/db';
import type { Note } from '../db/types';
import { t } from '../i18n';
import { useLive } from '../lib/hooks';

export const isPlayable = (b: Note['blocks'][number]) => b.type === 'audio' || b.type === 'video';

export function Notes() {
  const app = useApp();
  const notes = useLive(() => db.getAll('notes'), [], [] as Note[]);
  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="screen">
      <Header
        title={t('notes.title')}
        right={
          <button className="btn primary small" onClick={() => app.push({ name: 'note-edit' })}>
            <Icon name="plus" size={18} /> {t('notes.new')}
          </button>
        }
      />
      <p className="hint pad">{t('notes.intro')}</p>
      {sorted.length === 0 && <Empty icon="note" text={t('notes.empty')} />}
      <ul className="list">
        {sorted.map((n) => {
          const playable = n.blocks.filter(isPlayable);
          const learned = playable.filter((b) => b.learned).length;
          const texts = n.blocks.filter((b) => b.type === 'text').length;
          const images = n.blocks.filter((b) => b.type === 'image').length;
          return (
            <li key={n.id}>
              <div className="list-row">
                <button className="list-main as-btn" onClick={() => app.push({ name: 'note-edit', id: n.id })}>
                  <strong>{n.title || t('notes.untitled')}</strong>
                  <small>
                    <span className="counts">
                      {playable.length > 0 && (
                        <span>
                          <Icon name="mic" size={14} /> {playable.length}
                        </span>
                      )}
                      {texts > 0 && (
                        <span>
                          <Icon name="text" size={14} /> {texts}
                        </span>
                      )}
                      {images > 0 && (
                        <span>
                          <Icon name="image" size={14} /> {images}
                        </span>
                      )}
                      {playable.length > 0 && <span>{t('notes.learnedOf', { n: learned, total: playable.length })}</span>}
                    </span>
                  </small>
                </button>
                {playable.length > 0 && (
                  <button className="btn small" onClick={() => app.push({ name: 'note-play', id: n.id, learn: true })} aria-label={t('notes.learnLoop')}>
                    <Icon name="loop" size={20} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
