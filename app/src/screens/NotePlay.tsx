// Odtwarzanie notatki po kolei albo "pętla nauki": nieskończona pętla po nagraniach,
// z której user wyłącza te, których już się nauczył.
import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { MediaPlayer } from '../components/MediaPlayer';
import { NoteSequence, useMediaMap } from '../components/NotePlayer';
import { Header } from '../components/ui';
import * as db from '../db/db';
import type { Note } from '../db/types';
import { t } from '../i18n';
import { useLive } from '../lib/hooks';
import { keepAwake } from '../lib/platform';
import { isPlayable } from './Notes';

export function NotePlay({ id, learn }: { id: string; learn?: boolean }) {
  const app = useApp();
  const note = useLive(() => db.get('notes', id), [id], undefined as Note | undefined);
  const [token, setToken] = useState(0);
  const [rounds, setRounds] = useState(0);

  useEffect(() => {
    keepAwake(true);
    return () => void keepAwake(false);
  }, []);

  if (!note) return <div className="screen" />;
  return (
    <div className="screen">
      <Header title={note.title || t('notes.untitled')} onBack={app.back} />
      {learn ? (
        <LearnLoop note={note} />
      ) : (
        <>
          <NoteSequence
            note={note}
            playToken={token}
            onFinished={() => {
              setRounds((r) => r + 1);
              app.toast(t('notes.finishedOnce'));
            }}
          />
          <div className="row pad">
            <button className="btn" onClick={() => setToken((x) => x + 1)}>
              <Icon name="restart" size={18} /> {t('notes.fromStart')}
            </button>
            {rounds > 0 && <span className="muted">{t('notes.rounds', { n: rounds })}</span>}
          </div>
        </>
      )}
    </div>
  );
}

function LearnLoop({ note }: { note: Note }) {
  const mediaMap = useMediaMap();
  const playable = note.blocks.filter(isPlayable);
  const queue = playable.filter((b) => !b.learned);
  const [pos, setPos] = useState(0);
  const [token, setToken] = useState(0);
  const [round, setRound] = useState(1);
  const [paused, setPaused] = useState(false);

  const cur = queue.length ? queue[pos % queue.length] : undefined;

  const next = () => {
    if (!queue.length) return;
    const n = pos + 1;
    if (n >= queue.length) setRound((r) => r + 1);
    setPos(n % queue.length);
    setToken((x) => x + 1);
  };

  const setLearned = async (blockId: string, learned: boolean) => {
    const idxInQueue = queue.findIndex((b) => b.id === blockId);
    await db.put('notes', {
      ...note,
      blocks: note.blocks.map((b) => (b.id === blockId ? { ...b, learned } : b)),
      updatedAt: Date.now(),
    });
    // po usunięciu bieżącego z pętli zostajemy na tej samej pozycji (czyli następnym nagraniu)
    if (learned && idxInQueue !== -1 && idxInQueue < pos) setPos((p) => Math.max(0, p - 1));
    setToken((x) => x + 1);
  };

  const resetAll = () =>
    db.put('notes', { ...note, blocks: note.blocks.map((b) => ({ ...b, learned: false })), updatedAt: Date.now() });

  return (
    <div className="learn">
      <div className="learn-stats">
        <span>{t('learn.round', { n: round })}</span>
        <span>{t('notes.learnedOf', { n: playable.length - queue.length, total: playable.length })}</span>
      </div>

      {cur ? (
        <div className="card learn-cur">
          <p className="eyebrow">
            {t('learn.now')} {(pos % queue.length) + 1}/{queue.length}
          </p>
          <h2>{(cur.mediaId && mediaMap.get(cur.mediaId)?.title) || t('block.audio')}</h2>
          {cur.mediaId && mediaMap.get(cur.mediaId) && !paused && (
            <MediaPlayer key={cur.id} media={mediaMap.get(cur.mediaId)!} playToken={token} autoPlay onEnded={next} />
          )}
          <div className="row">
            <button className="btn ok" onClick={() => setLearned(cur.id, true)}>
              <Icon name="check" size={18} /> {t('learn.markLearned')}
            </button>
            <button className="btn ghost" onClick={next}>
              <Icon name="skip" size={16} /> {t('common.next')}
            </button>
            <button className="btn ghost" onClick={() => setPaused((p) => !p)}>
              <Icon name={paused ? 'play' : 'pause'} size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="sprout" size={30} />
          </div>
          <p>{t('learn.allLearned')}</p>
          <button className="btn" onClick={resetAll}>
            <Icon name="restart" size={18} /> {t('learn.resetAll')}
          </button>
        </div>
      )}

      <h2 className="section-title">{t('learn.list')}</h2>
      <ul className="list">
        {playable.map((b) => (
          <li key={b.id}>
            <label className={`list-row learn-row ${b.learned ? 'learned' : ''} ${cur?.id === b.id ? 'cur' : ''}`}>
              <input type="checkbox" checked={!b.learned} onChange={(e) => setLearned(b.id, !e.target.checked)} />
              <span className="list-main">
                <strong>{(b.mediaId && mediaMap.get(b.mediaId)?.title) || t('block.audio')}</strong>
                <small>{b.learned ? t('learn.excluded') : t('learn.inLoop')}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
