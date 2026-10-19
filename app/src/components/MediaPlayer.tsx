// Jeden odtwarzacz dla wszystkich źródeł. Zgłasza `onEnded` po każdym pełnym odtworzeniu,
// a zmiana `playToken` odtwarza od początku (tak robimy pętle).
import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../db/types';
import { t } from '../i18n';
import { blobUrl, isDirectMediaUrl, mediaIsVideo, spotifyEmbed, youtubeId } from '../lib/media';
import { openExternal } from '../lib/platform';

interface Props {
  media: MediaItem;
  playToken: number;
  autoPlay?: boolean;
  onEnded?: () => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    SC?: any;
  }
}

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  const existing = scripts.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scripts.delete(src);
      reject(new Error('script ' + src));
    };
    document.head.appendChild(s);
  });
  scripts.set(src, p);
  return p;
}

let ytReady: Promise<any> | null = null;
function loadYouTube(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytReady) {
    ytReady = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      loadScript('https://www.youtube.com/iframe_api').catch((e) => {
        ytReady = null;
        reject(e);
      });
    });
  }
  return ytReady;
}

function useLatest<T>(v: T) {
  const r = useRef(v);
  r.current = v;
  return r;
}

function YouTubePlayer({ media, playToken, autoPlay, onEnded }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const ended = useLatest(onEnded);
  const [error, setError] = useState<string | null>(null);
  const id = youtubeId(media.url ?? '');
  const first = useRef(true);

  useEffect(() => {
    if (!id || !host.current) return;
    let cancelled = false;
    const el = document.createElement('div');
    host.current.appendChild(el);
    loadYouTube()
      .then((YT) => {
        if (cancelled) return;
        player.current = new YT.Player(el, {
          videoId: id,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: autoPlay ? 1 : 0, playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
          events: {
            onStateChange: (e: { data: number }) => {
              if (e.data === 0) ended.current?.();
            },
            onError: (e: { data: number }) => setError(String(e.data)),
          },
        });
      })
      .catch(() => setError('offline'));
    return () => {
      cancelled = true;
      try {
        player.current?.destroy();
      } catch {
        /* ignore */
      }
      player.current = null;
      el.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const p = player.current;
    if (p?.seekTo) {
      p.seekTo(0, true);
      p.playVideo();
    }
  }, [playToken]);

  if (!id) return <p className="muted">{t('player.badLink')}</p>;
  return (
    <div>
      <div className="video-frame" ref={host} />
      {error && (
        <div className="player-error">
          <p>{t('player.ytError', { code: error })}</p>
          <button className="btn small" onClick={() => openExternal(media.url!)}>
            {t('player.openYoutube')}
          </button>
        </div>
      )}
    </div>
  );
}

function SoundCloudPlayer({ media, playToken, autoPlay, onEnded }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const widget = useRef<any>(null);
  const ended = useLatest(onEnded);
  const first = useRef(true);
  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(media.url ?? '')}&auto_play=${autoPlay ? 'true' : 'false'}&visual=false&show_comments=false`;

  useEffect(() => {
    let cancelled = false;
    loadScript('https://w.soundcloud.com/player/api.js')
      .then(() => {
        if (cancelled || !frame.current || !window.SC) return;
        const w = window.SC.Widget(frame.current);
        widget.current = w;
        w.bind(window.SC.Widget.Events.FINISH, () => ended.current?.());
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      widget.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.url]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    widget.current?.seekTo(0);
    widget.current?.play();
  }, [playToken]);

  return <iframe ref={frame} className="sc-frame" title={media.title} src={src} allow="autoplay" />;
}

function SpotifyPlayer({ media }: Props) {
  const embed = spotifyEmbed(media.url ?? '');
  return (
    <div>
      {embed && (
        <iframe
          className="spotify-frame"
          title={media.title}
          src={embed}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        />
      )}
      <p className="hint">{t('player.spotifyHint')}</p>
      <button className="btn small" onClick={() => openExternal(media.url!)}>
        {t('player.openSpotify')}
      </button>
    </div>
  );
}

function HtmlPlayer({ src, video, playToken, autoPlay, onEnded }: { src: string; video: boolean } & Omit<Props, 'media'>) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => undefined);
    }
  }, [playToken]);
  const common = {
    src,
    controls: true,
    autoPlay,
    playsInline: true,
    preload: 'auto',
    onEnded: () => onEnded?.(),
  };
  return video ? (
    <video ref={(el) => void (ref.current = el)} className="video-el" {...common} />
  ) : (
    <audio ref={(el) => void (ref.current = el)} className="audio-el" {...common} />
  );
}

function BlobPlayer({ media, ...rest }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (media.blobId) blobUrl(media.blobId).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [media.blobId]);
  if (!src) return <p className="muted">…</p>;
  if (media.kind === 'image') return <img className="media-img" src={src} alt={media.title} />;
  return <HtmlPlayer src={src} video={mediaIsVideo(media)} {...rest} />;
}

export function MediaPlayer(props: Props) {
  const { media } = props;
  switch (media.kind) {
    case 'youtube':
      return <YouTubePlayer {...props} />;
    case 'soundcloud':
      return <SoundCloudPlayer {...props} />;
    case 'spotify':
      return <SpotifyPlayer {...props} />;
    case 'file':
    case 'voice':
    case 'image':
      return <BlobPlayer {...props} />;
    case 'url': {
      const url = media.url ?? '';
      const direct = isDirectMediaUrl(url);
      if (direct) return <HtmlPlayer src={url} video={direct === 'video'} {...props} />;
      return (
        <div className="link-card">
          <p className="muted">{url}</p>
          <button className="btn small" onClick={() => openExternal(url)}>
            {t('player.openLink')}
          </button>
        </div>
      );
    }
  }
}

/** true, jeśli odtwarzacz sam wykryje koniec (można liczyć pętle automatycznie) */
export function detectsEnd(m: MediaItem): boolean {
  if (m.kind === 'youtube' || m.kind === 'soundcloud' || m.kind === 'file' || m.kind === 'voice') return true;
  if (m.kind === 'url') return isDirectMediaUrl(m.url ?? '') !== null;
  return false;
}
