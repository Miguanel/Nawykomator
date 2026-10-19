import { useEffect, useState } from 'react';
import * as db from '../db/db';
import type { MediaItem, Note, NoteBlock } from '../db/types';
import { t } from '../i18n';
import { useLive } from '../lib/hooks';
import { MediaPlayer } from './MediaPlayer';

export function useMediaMap(): Map<string, MediaItem> {
  const list = useLive(() => db.getAll('media'), [], [] as MediaItem[]);
  return new Map(list.map((m) => [m.id, m]));
}

export function BlockView({
  block,
  media,
  playToken,
  autoPlay,
  onEnded,
}: {
  block: NoteBlock;
  media?: MediaItem;
  playToken: number;
  autoPlay?: boolean;
  onEnded?: () => void;
}) {
  if (block.type === 'text') return <div className="note-text">{block.text}</div>;
  if (!media) return <p className="muted">{t('notes.missingMedia')}</p>;
  return <MediaPlayer key={media.id} media={media} playToken={playToken} autoPlay={autoPlay} onEnded={onEnded} />;
}

/**
 * Odtwarza notatkę blok po bloku (procedura). Nagrania/filmy przechodzą dalej same po zakończeniu,
 * tekst i obrazy – przyciskiem "Dalej". Po ostatnim bloku wywołuje onFinished.
 */
export function NoteSequence({ note, playToken, onFinished }: { note: Note; playToken: number; onFinished: () => void }) {
  const mediaMap = useMediaMap();
  const blocks = note.blocks.filter((b) => !b.learned);
  const [idx, setIdx] = useState(0);
  const [inner, setInner] = useState(0);

  useEffect(() => {
    setIdx(0);
    setInner((x) => x + 1);
  }, [playToken]);

  if (blocks.length === 0) return <p className="muted">{t('notes.emptyNote')}</p>;
  const b = blocks[Math.min(idx, blocks.length - 1)];
  const next = () => {
    if (idx + 1 >= blocks.length) {
      onFinished();
    } else {
      setIdx(idx + 1);
      setInner((x) => x + 1);
    }
  };

  return (
    <div className="note-seq">
      <div className="note-seq-head">
        <span>
          {t('notes.block')} {Math.min(idx, blocks.length - 1) + 1}/{blocks.length}
        </span>
        <div>
          <button className="icon-btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label={t('common.back')}>
            ←
          </button>
          <button className="icon-btn" onClick={next} aria-label={t('common.next')}>
            →
          </button>
        </div>
      </div>
      <BlockView key={`${b.id}-${inner}`} block={b} media={b.mediaId ? mediaMap.get(b.mediaId) : undefined} playToken={0} autoPlay onEnded={next} />
      {(b.type === 'text' || b.type === 'image') && (
        <button className="btn wide" onClick={next}>
          {t('common.next')} →
        </button>
      )}
    </div>
  );
}
