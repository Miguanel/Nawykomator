import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../db/types';
import { t } from '../i18n';
import { createBlobMedia, createLinkMedia, detectKind } from '../lib/media';
import { startDictation, speechAvailable, type Dictation } from '../lib/speech';
import { startRecording, type ActiveRecording } from '../lib/recorder';
import { hhmm, pad } from '../lib/util';

function nowLabel() {
  const d = new Date();
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${hhmm(d)}`;
}

/** Przycisk nagrywania głosu. Zapisuje nagranie jako MediaItem typu "voice". */
export function RecordButton({ onSaved, label }: { onSaved: (m: MediaItem) => void; label?: string }) {
  const [rec, setRec] = useState<ActiveRecording | null>(null);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    [],
  );

  const start = async () => {
    setErr(null);
    try {
      const r = await startRecording();
      setRec(r);
      setSecs(0);
      timer.current = window.setInterval(() => setSecs((s) => s + 1), 1000);
    } catch {
      setErr(t('rec.noMic'));
    }
  };
  const stop = async () => {
    if (!rec) return;
    if (timer.current) window.clearInterval(timer.current);
    const blob = await rec.stop();
    setRec(null);
    const m = await createBlobMedia(blob, 'voice', `${t('rec.defaultTitle')} ${nowLabel()}`);
    onSaved(m);
  };

  return (
    <div className="rec">
      {rec ? (
        <button type="button" className="btn danger rec-on" onClick={stop}>
          <span className="rec-dot" aria-hidden="true" /> {t('rec.stop')} {Math.floor(secs / 60)}:{pad(secs % 60)}
        </button>
      ) : (
        <button type="button" className="btn" onClick={start}>
          <Icon name="mic" size={18} /> {label ?? t('rec.start')}
        </button>
      )}
      {err && <p className="error">{err}</p>}
    </div>
  );
}

/** Dyktowanie: dopisuje rozpoznany tekst do pola. */
export function DictateButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [active, setActive] = useState<Dictation | null>(null);
  const [available, setAvailable] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    speechAvailable().then(setAvailable);
  }, []);
  if (!available) return null;

  const toggle = async () => {
    if (active) {
      await active.stop();
      setActive(null);
      return;
    }
    setErr(null);
    const base = value.trim();
    try {
      const d = await startDictation(
        (txt) => onChange(base ? `${base} ${txt}` : txt),
        () => setActive(null),
      );
      setActive(d);
    } catch {
      setErr(t('dictate.error'));
    }
  };

  return (
    <>
      <button type="button" className={`btn small ${active ? 'danger' : 'ghost'}`} onClick={toggle}>
        <Icon name={active ? 'stop' : 'speech'} size={16} /> {active ? t('dictate.stop') : t('dictate.start')}
      </button>
      {err && <span className="error">{err}</span>}
    </>
  );
}

type Accept = 'media' | 'audio' | 'image' | 'video';
const ACCEPT_ATTR: Record<Accept, string> = {
  media: 'audio/*,video/*,image/*',
  audio: 'audio/*',
  image: 'image/*',
  video: 'video/*',
};

/** Wybór źródła: link (YouTube/SoundCloud/Spotify/URL), plik z telefonu albo nagranie głosu. */
export function MediaPicker({
  onPicked,
  accept = 'media',
  allowLink = true,
  allowRecord = true,
}: {
  onPicked: (m: MediaItem) => void;
  accept?: Accept;
  allowLink?: boolean;
  allowRecord?: boolean;
}) {
  const [tab, setTab] = useState<'link' | 'file' | 'rec'>(allowLink ? 'link' : 'file');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const kind = url.trim() ? detectKind(url.trim()) : null;

  const addLink = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      onPicked(await createLinkMedia(url));
      setUrl('');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const k = f.type.startsWith('image/') ? 'image' : 'file';
      onPicked(await createBlobMedia(f, k, f.name.replace(/\.[^.]+$/, '')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="picker">
      <div className="seg">
        {allowLink && (
          <button type="button" className={tab === 'link' ? 'on' : ''} onClick={() => setTab('link')}>
            <Icon name="link" size={18} /> {t('picker.link')}
          </button>
        )}
        <button type="button" className={tab === 'file' ? 'on' : ''} onClick={() => setTab('file')}>
          <Icon name="file" size={18} /> {t('picker.file')}
        </button>
        {allowRecord && (
          <button type="button" className={tab === 'rec' ? 'on' : ''} onClick={() => setTab('rec')}>
            <Icon name="mic" size={18} /> {t('picker.record')}
          </button>
        )}
      </div>

      {tab === 'link' && (
        <div className="picker-pane">
          <input
            type="url"
            inputMode="url"
            placeholder={t('picker.linkPlaceholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLink()}
          />
          {kind && <p className="hint">{t(`kind.${kind}` as 'kind.url')}</p>}
          <button type="button" className="btn primary" disabled={!url.trim() || busy} onClick={addLink}>
            {t('common.add')}
          </button>
        </div>
      )}
      {tab === 'file' && (
        <div className="picker-pane">
          <label className="btn file-btn">
            {t('picker.chooseFile')}
            <input type="file" accept={ACCEPT_ATTR[accept]} hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <p className="hint">{t('picker.fileHint')}</p>
        </div>
      )}
      {tab === 'rec' && (
        <div className="picker-pane">
          <RecordButton onSaved={onPicked} />
        </div>
      )}
    </div>
  );
}
