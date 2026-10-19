// Spójny zestaw ikon liniowych (zamiast emoji).
import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  play: 'M7.5 5.2v13.6a.6.6 0 0 0 .9.5l10.6-6.8a.6.6 0 0 0 0-1L8.4 4.7a.6.6 0 0 0-.9.5Z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.2 2',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
  file: 'M6.5 3h7l4 4v14h-11ZM13.5 3v4h4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  image: 'M4 5h16v14H4ZM8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM20 15l-5-5-8 9',
  video: 'M3.5 6.5h11v11h-11ZM14.5 10.5l6-3.5v10l-6-3.5',
  music: 'M9 18V6l11-2v12M9 18a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 0 1 5.6 0ZM20 16a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 0 1 5.6 0Z',
  text: 'M5 6.5h14M5 12h14M5 17.5h9',
  note: 'M6 3h9l4 4v14H6ZM14.5 3v4.5H19M9 12.5h7M9 16.5h5',
  loop: 'M17 2.5l3 3-3 3M4 11.5v-2a4 4 0 0 1 4-4h12M7 21.5l-3-3 3-3M20 12.5v2a4 4 0 0 1-4 4H4',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6 7l1 13.5h10L18 7',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5.5 8.5 12l6.5 6.5',
  chevron: 'M9 5.5l6.5 6.5L9 18.5',
  plus: 'M12 5v14M5 12h14',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15ZM10 20.5a2 2 0 0 0 4 0',
  cup: 'M4 8.5h12.5V14a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM16.5 10H18a2.5 2.5 0 0 1 0 5h-1.5M8 3v2.5M12 3v2.5',
  leaf: 'M5 19.5C5 10.5 11 5 20 4c-.5 9-6.5 15.5-15 15.5ZM5 19.5l8.5-8.5',
  sprout: 'M12 21v-8M12 13c0-4.2 3-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5ZM12 15.5c0-3.4-2.4-5.5-6.5-5.5 0 3.4 2.4 5.5 6.5 5.5Z',
  pause: 'M8.5 5.5v13M15.5 5.5v13',
  skip: 'M6 5.5l9 6.5-9 6.5ZM18.5 5.5v13',
  restart: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4',
  speech: 'M4 5h16v11H9.5L4 20Z',
  external: 'M14 4h6v6M20 4l-9 9M18.5 14v6.5h-15v-15H10',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.5v.2',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15.5 8.5l-2 5-5 2 2-5Z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1 1-1.1 1.7v.4M12 16.8v.2',
  today: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  tasks: 'M10 6.5h10M10 12h10M10 17.5h10M4 6.5l1.2 1.2L7.5 5.3M4 12l1.2 1.2 2.3-2.4M4 17.5l1.2 1.2 2.3-2.4',
  stats: 'M5 20v-8M10.5 20V5M16 20v-5.5M21 20H3',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  stop: 'M7 7h10v10H7Z',
  record: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, style, className }: { name: IconName; size?: number; style?: CSSProperties; className?: string }) {
  const filled = name === 'play' || name === 'record';
  return (
    <svg
      className={`icon ${className ?? ''}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={P[name]} />
    </svg>
  );
}
