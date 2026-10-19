import { hideTip, tipVisible, useGuide } from '../lib/guide';
import { Icon } from '../components/Icon';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { DictateButton, RecordButton } from '../components/MediaPicker';
import { BlockView, useMediaMap } from '../components/NotePlayer';
import { Header, Modal, Tip, Toggle } from '../components/ui';
import * as db from '../db/db';
import type { MediaItem, Note, NoteBlock } from '../db/types';
import { t } from '../i18n';
import { createBlobMedia, deleteMedia } from '../lib/media';
import { uid } from '../lib/util';
import { isPlayable } from './Notes';

function newNote(): Note {
  return { id: uid(), title: '', blocks: [], createdAt: Date.now(), updatedAt: Date.now() };
}

export function NoteEditor({ id }: { id?: string }) {
  const app = useApp();
  const [note, setNote] = useState<Note | null>(id ? null : newNote());
  const [confirmDel, setConfirmDel] = useState(false);
  const mediaMap = useMediaMap();
  const dirty = useRef(false);
  const guide = useGuide();

  useEffect(() => {
    if (id) db.get('notes', id).then((n) => setNote(n ?? newNote()));
  }, [id]);

  // autozapis – nagrania nie zginą, nawet gdy user nie kliknie "Gotowe"
  useEffect(() => {
    if (!note || !dirty.current) return;
    const h = window.setTimeout(() => db.put('notes', { ...note, updatedAt: Date.now() }), 400);
    return () => window.clearTimeout(h);
  }, [note]);

  if (!note) return null;

  const patch = (p: Partial<Note>) => {
    dirty.current = true;
    setNote({ ...note, ...p });
  };
  const patchBlock = (bid: string, p: Partial<NoteBlock>) => patch({ blocks: note.blocks.map((b) => (b.id === bid ? { ...b, ...p } : b)) });
  const addBlock = (b: Omit<NoteBlock, 'id'>) => patch({ blocks: [...note.blocks, { id: uid(), ...b }] });
  const move = (i: number, d: -1 | 1) => {
    const blocks = [...note.blocks];
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    patch({ blocks });
  };
  const remove = async (b: NoteBlock) => {
    patch({ blocks: note.blocks.filter((x) => x.id !== b.id) });
    if (b.mediaId) await deleteMedia(b.mediaId);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const type: NoteBlock['type'] = f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'audio';
    const m = await createBlobMedia(f, type === 'image' ? 'image' : 'file', f.name.replace(/\.[^.]+$/, ''));
    addBlock({ type, mediaId: m.id });
  };

  const done = async () => {
    if (dirty.current) await db.put('notes', { ...note, title: note.title.trim() || t('notes.untitled'), updatedAt: Date.now() });
    app.back();
  };

  const playable = note.blocks.filter(isPlayable);

  return (
    <div className="screen editor">
      <Header
        title={id ? t('notes.edit') : t('notes.new')}
        onBack={done}
        right={
          <button className="btn primary small" onClick={done}>
            {t('common.done')}
          </button>
        }
      />
      {tipVisible(guide, 'note') && <Tip onClose={() => hideTip('note')}>{t('tip.note')}</Tip>}
      <section className="card form">
        <label>
          {t('notes.noteTitle')}
          <input value={note.title} placeholder={t('notes.titlePlaceholder')} onChange={(e) => patch({ title: e.target.value })} />
        </label>
      </section>

      {note.blocks.length > 0 && (
        <div className="row pad">
          <button className="btn" onClick={() => app.push({ name: 'note-play', id: note.id })}>
            <Icon name="play" size={16} /> {t('notes.playAll')}
          </button>
          {playable.length > 0 && (
            <button className="btn" onClick={() => app.push({ name: 'note-play', id: note.id, learn: true })}>
              <Icon name="loop" size={18} /> {t('notes.learnLoop')}
            </button>
          )}
        </div>
      )}

      <ol className="blocks">
        {note.blocks.map((b, i) => (
          <li key={b.id} className={`card block ${b.learned ? 'learned' : ''}`}>
            <div className="step-head">
              <span className="step-num">{i + 1}</span>
              <span className="block-type">{t(`block.${b.type}` as 'block.text')}</span>
              <div className="step-tools">
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('editor.up')}>
                  <Icon name="up" size={18} />
                </button>
                <button className="icon-btn" disabled={i === note.blocks.length - 1} onClick={() => move(i, 1)} aria-label={t('editor.down')}>
                  <Icon name="down" size={18} />
                </button>
                <button className="icon-btn" onClick={() => remove(b)} aria-label={t('common.delete')}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </div>
            {b.type === 'text' ? (
              <div className="step-text">
                <textarea rows={4} value={b.text ?? ''} placeholder={t('notes.textPlaceholder')} onChange={(e) => patchBlock(b.id, { text: e.target.value })} />
                <DictateButton value={b.text ?? ''} onChange={(v) => patchBlock(b.id, { text: v })} />
              </div>
            ) : (
              <>
                <MediaTitle media={b.mediaId ? mediaMap.get(b.mediaId) : undefined} />
                <BlockView block={b} media={b.mediaId ? mediaMap.get(b.mediaId) : undefined} playToken={0} />
              </>
            )}
            {isPlayable(b) && (
              <Toggle checked={!!b.learned} onChange={(v) => patchBlock(b.id, { learned: v })} label={t('notes.learned')} />
            )}
          </li>
        ))}
      </ol>

      <div className="add-step">
        <button className="btn" onClick={() => addBlock({ type: 'text', text: '' })}>
          <Icon name="text" size={18} /> {t('notes.addText')}
        </button>
        <RecordButton label={t('notes.addVoice')} onSaved={(m) => addBlock({ type: 'audio', mediaId: m.id })} />
        <label className="btn file-btn">
          <Icon name="file" size={18} /> {t('notes.addFile')}
          <input type="file" accept="audio/*,video/*,image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>

      {id && (
        <button className="btn danger wide" onClick={() => setConfirmDel(true)}>
          {t('notes.delete')}
        </button>
      )}
      <div className="bottom-space" />

      {confirmDel && (
        <Modal
          title={t('notes.deleteQ')}
          onClose={() => setConfirmDel(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setConfirmDel(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn danger"
                onClick={async () => {
                  for (const b of note.blocks) if (b.mediaId) await deleteMedia(b.mediaId);
                  await db.del('notes', note.id);
                  dirty.current = false;
                  app.back();
                }}
              >
                {t('common.delete')}
              </button>
            </>
          }
        >
          <p>{t('notes.deleteHint')}</p>
        </Modal>
      )}
    </div>
  );
}

function MediaTitle({ media }: { media?: MediaItem }) {
  const [v, setV] = useState(media?.title ?? '');
  useEffect(() => setV(media?.title ?? ''), [media?.title]);
  if (!media) return null;
  return (
    <input
      className="media-title"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== media.title && db.put('media', { ...media, title: v.trim() })}
    />
  );
}
