import { useEffect, type ReactNode } from 'react';
import { t } from '../i18n';
import { Icon, type IconName } from './Icon';

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 999,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  return (
    <div className="stepper" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="−">
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="+">
        +
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="screen-head">
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label={t('common.back')}>
          <Icon name="back" size={22} />
        </button>
      )}
      <h1>{title}</h1>
      <div className="screen-head-right">{right}</div>
    </header>
  );
}

export function Empty({ icon, text, children }: { icon: IconName; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={30} />
      </div>
      <p>{text}</p>
      {children}
    </div>
  );
}

/** Wskazówka przewodnika – mała ramka z podpowiedzią, którą można zamknąć. */
export function Tip({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="tip" role="note">
      <Icon name="sprout" size={20} className="tip-icon" />
      <div className="tip-body">{children}</div>
      {onClose && (
        <button className="icon-btn small" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

/** Punkty narysowane jako słoje drzewa – im więcej punktów, tym więcej słojów. */
export function TreeRings({ points, label }: { points: number; label: string }) {
  const rings = Math.min(5, 1 + Math.floor(Math.log2(1 + points / 10)));
  return (
    <div className="rings" aria-label={`${points} ${label}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => {
          const r = 46 - i * 8;
          return (
            <ellipse
              key={i}
              cx={50 + (i % 2 ? 0.8 : -0.6)}
              cy={50 + (i % 2 ? -0.6 : 0.7)}
              rx={r}
              ry={r * 0.95}
              className={i < 5 - rings ? 'ring faint' : 'ring'}
            />
          );
        })}
      </svg>
      <span className="rings-num">
        <strong>{points}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

/** Postęp dnia jako rząd liści: wypełniony liść = zrobione wykonanie. */
export function LeafProgress({ done, total }: { done: number; total: number }) {
  return (
    <div className="leaves" role="img" aria-label={t('today.progress', { done, total })}>
      {Array.from({ length: total }, (_, i) => (
        <Icon key={i} name="leaf" size={20} className={i < done ? 'leaf on' : 'leaf'} />
      ))}
    </div>
  );
}
