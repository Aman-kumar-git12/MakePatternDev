import { useState, type CSSProperties, type ReactNode } from 'react';
import { PLATFORMS, platformStyle } from '../lib/platforms';
import type { PlatformId } from '../lib/types';

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

/**
 * CSS variables scoping a subtree to one platform's colors (pairs with plat-* classes):
 * --p / --p-fg from `platformStyle`, plus --p-solid (background behind text) and --p-ink
 * (the brand hue as readable text), both tuned for WCAG AA in styles.css.
 */
export function platformVars(platform: PlatformId): CSSProperties {
  return {
    ...platformStyle(platform),
    '--p-solid': `var(--plat-${platform}-solid)`,
    '--p-ink': `var(--plat-${platform}-ink)`,
  } as CSSProperties;
}

export function Card({ children, className, highlight }: { children: ReactNode; className?: string; highlight?: boolean }) {
  return <div className={cx('card p-3.5', highlight && 'ring-1 ring-accent', className)}>{children}</div>;
}

export function SectionTitle({ children, right, icon }: { children: ReactNode; right?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-1.5 text-[12px] font-bold tracking-tight text-ink">
        {icon && <span className="text-ink-3">{icon}</span>}
        {children}
      </h2>
      {right}
    </div>
  );
}

/**
 * The site's own icon on a white disc ringed in its brand color; falls back to its initial.
 * Decorative by default; pass `named` where the icon is the only platform cue so screen
 * readers still hear the platform's name.
 */
export function PlatformIcon({ platform, size = 20, className, named }: { platform: PlatformId; size?: number; className?: string; named?: boolean }) {
  const p = PLATFORMS[platform];
  const [failed, setFailed] = useState(false);
  const icon = (
    <span
      className={cx('plat-icon', className)}
      style={{ ...platformVars(platform), width: size, height: size }}
      title={p.name}
      aria-hidden
    >
      {failed ? (
        <span style={{ fontSize: Math.max(8, size * 0.42) }}>{p.mono}</span>
      ) : (
        <img src={p.icon} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      )}
    </span>
  );
  if (!named) return icon;
  return (
    <>
      {icon}
      <span className="sr-only">{p.name}: </span>
    </>
  );
}

/** Square icon-only button with at least a 32px hit area. */
export function IconButton({
  children,
  onClick,
  title,
  disabled,
  className,
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  title: string;
  disabled?: boolean;
  className?: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Difficulty({ value }: { value?: string }) {
  if (!value) return null;
  const v = value.toLowerCase();
  const tone =
    v === 'easy' || v === 'basic' || v === 'school'
      ? 'bg-[color-mix(in_srgb,var(--good)_14%,transparent)] text-good-text'
      : v === 'medium'
        ? 'bg-[color-mix(in_srgb,var(--warning-text)_14%,transparent)] text-warning-text'
        : v === 'hard'
          ? 'bg-[color-mix(in_srgb,var(--critical)_14%,transparent)] text-critical'
          : 'bg-surface-2 text-ink-2';
  return <span className={cx('rounded-full px-1.5 py-px text-[10px] font-bold', tone)}>{value}</span>;
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  title,
  className,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  title?: string;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'brand-gradient text-white shadow-sm hover:brightness-110',
        variant === 'secondary' && 'border border-line bg-card text-ink hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cx('hover:underline', className)}>
      {children}
    </a>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs text-ink-3">{children}</p>;
}

export function ErrorNote({ errors }: { errors: Record<string, string | undefined> }) {
  const entries = Object.entries(errors).filter(([, e]) => e);
  if (!entries.length) return null;
  return (
    <p className="mt-2 text-[11px] text-ink-3">
      ⚠ Couldn't refresh {entries.map(([k]) => PLATFORMS[k as PlatformId]?.name ?? k).join(', ')}, so this shows the last saved data.
    </p>
  );
}

/** Headline number with a label (and optional icon / sub-line). */
export function StatTile({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card px-3 py-2.5">
      <div className="flex items-center gap-1 text-[10.5px] font-semibold text-ink-3">
        {icon}
        {label}
      </div>
      <div className="tabular mt-0.5 text-[19px] leading-tight font-extrabold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[10.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

/** Circular progress (value 0..1) with centered content. */
export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  color = 'var(--accent)',
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label} title={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Horizontal bars for one measure; rows tied to a platform use its brand color. */
export function BarList({
  rows,
  format,
}: {
  rows: { key: string; label: ReactNode; value: number; title?: string; platform?: PlatformId }[];
  format: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="group" title={r.title ?? `${format(r.value)}`}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
            <span className="min-w-0 truncate text-ink-2">{r.label}</span>
            <span className="tabular shrink-0 font-semibold text-ink">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div
              className={cx('h-2 rounded-full transition-[width] group-hover:brightness-110', r.platform ? 'plat-bar' : 'brand-gradient')}
              style={{ width: `${Math.max(3, (r.value / max) * 100)}%`, ...(r.platform ? platformVars(r.platform) : {}) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
