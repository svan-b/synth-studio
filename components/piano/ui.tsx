'use client';

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

// ------------------------------------------------------------------ icons

type IconProps = { size?: number; className?: string };

function Svg({ size = 22, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Today: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </Svg>
  ),
  Learn: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" transform="translate(0 -2)" />
    </Svg>
  ),
  Pieces: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </Svg>
  ),
  Train: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </Svg>
  ),
  Progress: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  ),
  Settings: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0-1.2-2.8H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 2.8-1.2V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0 1.2 2.8h.1a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Svg>
  ),
  Close: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  ),
  Play: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Stop: (p: IconProps) => (
    <Svg {...p}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Repeat: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5" />
    </Svg>
  ),
  Right: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  ),
  Left: (p: IconProps) => (
    <Svg {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  ),
  Ear: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7 14a6 6 0 1 1 11-3c0 3-3 3.5-3 6a3 3 0 0 1-5.5 1.6" />
      <path d="M10.5 12a2.5 2.5 0 1 1 4-2" />
    </Svg>
  ),
  Pulse: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </Svg>
  ),
  Eye: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  Piano: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 5v8M12 5v8M16 5v8M7 13h2v6M11 13h2v6M15 13h2v6" />
    </Svg>
  ),
  Cable: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7 7V3M11 7V3M5 7h8v4a4 4 0 0 1-8 0zM9 15v2a3 3 0 0 0 3 3h3a3 3 0 0 0 3-3v-3" />
      <rect x="16" y="9" width="4" height="5" rx="1" />
    </Svg>
  ),
  Bluetooth: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7 7l10 10-5 4V3l5 4L7 17" />
    </Svg>
  ),
  Mic: (p: IconProps) => (
    <Svg {...p}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </Svg>
  ),
  Lock: (p: IconProps) => (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  ),
  Info: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </Svg>
  ),
  Flame: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 1.5-4.5C9 10 10 11 10 11c0-3 1-5.500 2-8z" />
    </Svg>
  ),
  Clock: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  ),
  Hand: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 13V5.500a1.500 1.500 0 0 1 3 0V11M11 11V4a1.500 1.500 0 0 1 3 0v7M14 11V5.500a1.500 1.500 0 0 1 3 0V14M17 9.500a1.500 1.500 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.500a6 6 0 0 1-5-2.700L4.300 13.800a1.500 1.500 0 0 1 2.500-1.600L8 13.500" />
    </Svg>
  ),
};

// ---------------------------------------------------------------- buttons

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Small note under the label, such as the piano key that does the same thing. */
  hint?: string;
  icon?: ReactNode;
};

export function Button({ variant = 'primary', size = 'md', hint, icon, className, children, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,opacity,background-color] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 select-none';
  const sizes = { sm: 'h-9 px-4 text-sm', md: 'h-12 px-6 text-base', lg: 'h-14 px-8 text-lg' };
  const variants = {
    primary: 'bg-mc-ink text-mc-bg',
    soft: 'bg-mc-raised text-mc-ink',
    ghost: 'text-mc-muted hover:text-mc-ink',
    danger: 'bg-mc-bad/10 text-mc-bad',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className ?? ''}`} {...rest}>
      {icon}
      <span className="flex flex-col items-center leading-tight">
        <span>{children}</span>
        {hint && <span className="text-[10px] font-medium uppercase tracking-wider opacity-60">{hint}</span>}
      </span>
    </button>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full text-mc-muted transition-colors active:bg-mc-raised ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ----------------------------------------------------------------- pieces

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`rounded-2xl border border-mc-line bg-mc-surface text-left ${onClick ? 'transition-transform active:scale-[0.99]' : ''} ${className ?? ''}`}
    >
      {children}
    </Tag>
  );
}

export function ProgressBar({ value, className, tone = 'ink' }: { value: number; className?: string; tone?: 'ink' | 'ok' | 'accent' }) {
  const color = tone === 'ok' ? 'bg-mc-ok' : tone === 'accent' ? 'bg-mc-accent' : 'bg-mc-ink';
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-mc-line ${className ?? ''}`}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-500`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Ring({ value, size = 56, stroke = 5, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--mc-line))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--mc-ok))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">{children}</div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex rounded-full bg-mc-raised p-1 ${className ?? ''}`} role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
            o.value === value ? 'bg-mc-surface text-mc-ink shadow-sm' : 'text-mc-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${value ? 'bg-mc-ok' : 'bg-mc-line'}`}
    >
      <span
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] duration-200"
        style={{ left: value ? 28 : 4 }}
      />
    </button>
  );
}

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) setShown(true);
    else {
      const t = setTimeout(() => setShown(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);
  if (!shown) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-full w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} flex-col rounded-3xl bg-mc-surface shadow-2xl transition-[opacity,transform] duration-200 ${
          open ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between px-7 pt-6">
          <h2 className="font-mc-serif text-2xl">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <Icon.Close />
          </IconButton>
        </div>
        <div className="mc-scroll min-h-0 flex-1 px-7 pb-7 pt-3">{children}</div>
      </div>
    </div>
  );
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'ok' | 'accent' | 'hint' | 'bad' }) {
  const tones = {
    muted: 'bg-mc-raised text-mc-muted',
    ok: 'bg-mc-ok/12 text-mc-ok',
    accent: 'bg-mc-accent/10 text-mc-accent',
    hint: 'bg-mc-hint/15 text-mc-hint',
    bad: 'bg-mc-bad/10 text-mc-bad',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

/** Text with **bold** spans and blank lines as paragraph breaks. */
export function Prose({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n\s*\n/);
  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {paragraphs.map((p, i) => (
        <p key={i}>
          {p.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={j} className="font-semibold text-mc-ink">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
