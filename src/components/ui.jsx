/** Shared UI primitives used across the storefront and admin dashboard. */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { discountOf, inr } from '../lib/format';
import { imageUrl } from '../lib/api';
import { useStore } from '../context/StoreProvider';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

const FALLBACK_IMG = imageUrl('/api/img/product/zyrex-fallback.svg?glyph=box&hue=250&label=ZYREX');

export function Spinner({ className = 'h-5 w-5' }) {
  return <span className={cx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-hidden="true" />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-ink-500 dark:text-ink-400">
      <Spinner className="h-8 w-8 text-brand-600" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={cx('animate-pulse rounded-lg bg-ink-200/70 dark:bg-ink-800', className)} />;
}

export function SmartImage({ src, alt = '', className = '', wrapperClass = '', ...rest }) {
  return (
    <span className={cx('block overflow-hidden bg-ink-100 dark:bg-ink-900', wrapperClass)}>
      <img
        src={src || FALLBACK_IMG}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cx('h-full w-full object-cover', className)}
        onError={(e) => {
          if (e.currentTarget.src.endsWith(FALLBACK_IMG)) return;
          e.currentTarget.src = FALLBACK_IMG;
        }}
        {...rest}
      />
    </span>
  );
}

export function Stars({ value = 0, count, size = 'sm', className = '' }) {
  const rounded = Math.round(Number(value) * 2) / 2;
  const px = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <span className={cx('inline-flex items-center gap-1', className)} aria-label={`Rated ${value} out of 5`}>
      <span className="flex items-center gap-0.5 text-accent-500">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} viewBox="0 0 20 20" className={px} fill={i <= rounded ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M10 1.8l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 15l-5.2 2.8 1-5.8L1.6 7.9l5.8-.8z" strokeLinejoin="round" />
          </svg>
        ))}
      </span>
      <span className="text-xs font-semibold text-ink-600 dark:text-ink-300">{Number(value || 0).toFixed(1)}</span>
      {count !== undefined && <span className="text-xs text-ink-400">({Number(count).toLocaleString('en-IN')})</span>}
    </span>
  );
}

export function Price({ price, mrp, size = 'md', showDiscount = true, className = '' }) {
  const off = discountOf(mrp, price);
  const main = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-base';
  return (
    <span className={cx('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={cx('font-display font-bold text-ink-900 dark:text-white', main)}>{inr(price)}</span>
      {mrp > price && <span className="text-xs text-ink-400 line-through">{inr(mrp)}</span>}
      {showDiscount && off > 0 && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{off}% off</span>}
    </span>
  );
}

const TONES = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  info: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
  muted: 'bg-ink-100 text-ink-600 ring-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-700',
  dark: 'bg-ink-900 text-white ring-ink-900 dark:bg-white dark:text-ink-900 dark:ring-white',
};

export function Badge({ children, tone = 'brand', className = '' }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', TONES[tone] || TONES.brand, className)}>
      {children}
    </span>
  );
}

export function Section({ title, subtitle, href, linkLabel = 'View all', children, className = '', eyebrow }) {
  return (
    <section className={cx('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">{eyebrow}</p>}
          <h2 className="font-display text-xl font-bold tracking-tight text-ink-900 sm:text-2xl dark:text-white">{title}</h2>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
        </div>
        {href && (
          <Link to={href} className="group inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
            {linkLabel}
            <span className="transition group-hover:translate-x-0.5">→</span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function Breadcrumbs({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
      <Link to="/" className="hover:text-brand-700 dark:hover:text-brand-300">Home</Link>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden="true">/</span>
          {item.to ? (
            <Link to={item.to} className="hover:text-brand-700 dark:hover:text-brand-300">{item.label}</Link>
          ) : (
            <span className="font-medium text-ink-700 dark:text-ink-200">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function EmptyState({ icon = '🛍️', title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink-200 bg-white/60 px-6 py-16 text-center dark:border-ink-800 dark:bg-ink-900/40">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl dark:bg-brand-500/10">{icon}</div>
      <h3 className="font-display text-lg font-bold text-ink-900 dark:text-white">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-ink-500 dark:text-ink-400">{text}</p>}
      {action}
    </div>
  );
}

export function Pagination({ page = 1, pages = 1, onChange }) {
  if (pages <= 1) return null;
  const list = [];
  const push = (p) => list.push(p);
  const from = Math.max(1, page - 2);
  const to = Math.min(pages, from + 4);
  for (let p = from; p <= to; p += 1) push(p);
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-xl border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-600 transition enabled:hover:border-brand-400 enabled:hover:text-brand-700 disabled:opacity-40 dark:border-ink-700 dark:text-ink-300"
      >
        Prev
      </button>
      {list.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-current={p === page ? 'page' : undefined}
          className={cx(
            'h-10 w-10 rounded-xl text-sm font-bold transition',
            p === page
              ? 'bg-brand-600 text-white shadow-card'
              : 'border border-ink-200 text-ink-600 hover:border-brand-400 hover:text-brand-700 dark:border-ink-700 dark:text-ink-300'
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        className="rounded-xl border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-600 transition enabled:hover:border-brand-400 enabled:hover:text-brand-700 disabled:opacity-40 dark:border-ink-700 dark:text-ink-300"
      >
        Next
      </button>
    </nav>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div className={cx('relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-float animate-fade-up sm:rounded-3xl dark:bg-ink-900', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800" aria-label="Close">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" /></svg>
          </button>
        </div>
        {children}
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (!toasts.length) return null;
  const tone = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    error: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
    warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((t) => (
        <div key={t.id} className={cx('pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-float animate-fade-up', tone[t.tone] || tone.info)} role="status">
          <span className="mt-0.5">•</span>
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => dismissToast(t.id)} className="text-current/70 hover:text-current" aria-label="Dismiss">✕</button>
        </div>
      ))}
    </div>
  );
}

export function QtyStepper({ value, onChange, min = 1, max = 10, disabled = false }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-ink-200 dark:border-ink-700">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min} className="px-3 py-1.5 text-lg leading-none text-ink-600 disabled:opacity-40 dark:text-ink-300" aria-label="Decrease quantity">−</button>
      <span className="min-w-8 text-center text-sm font-bold text-ink-900 dark:text-white">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} className="px-3 py-1.5 text-lg leading-none text-ink-600 disabled:opacity-40 dark:text-ink-300" aria-label="Increase quantity">+</button>
    </div>
  );
}

const fieldBase =
  'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-white dark:placeholder:text-ink-500';

export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-rose-600 dark:text-rose-400">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>
      )}
    </label>
  );
}

export const Input = ({ className = '', ...props }) => <input className={cx(fieldBase, className)} {...props} />;
export const Select = ({ className = '', children, ...props }) => (
  <select className={cx(fieldBase, 'pr-8', className)} {...props}>{children}</select>
);
export const Textarea = ({ className = '', rows = 4, ...props }) => (
  <textarea rows={rows} className={cx(fieldBase, 'resize-y', className)} {...props} />
);

export function Button({ as = 'button', variant = 'primary', size = 'md', className = '', children, ...props }) {
  const variants = {
    primary: 'bg-brand-600 text-white shadow-card hover:bg-brand-700 active:bg-brand-800',
    dark: 'bg-ink-900 text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100',
    outline: 'border border-ink-200 bg-white text-ink-800 hover:border-brand-400 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100',
    ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white',
    accent: 'bg-accent-500 text-ink-950 hover:bg-accent-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  const cls = cx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50',
    variants[variant] || variants.primary,
    sizes[size] || sizes.md,
    className
  );
  if (as === 'a') return <a className={cls} {...props}>{children}</a>;
  if (as === Link) return <Link className={cls} {...props}>{children}</Link>;
  return <button type="button" className={cls} {...props}>{children}</button>;
}

export function StatCard({ label, value, sub, tone = 'brand', icon }) {
  const tones = {
    brand: 'from-brand-600 to-brand-500',
    emerald: 'from-emerald-600 to-emerald-500',
    amber: 'from-amber-500 to-amber-400',
    rose: 'from-rose-600 to-rose-500',
    sky: 'from-sky-600 to-sky-500',
    ink: 'from-ink-800 to-ink-700',
  };
  return (
    <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-800 dark:bg-ink-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-ink-900 dark:text-white">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{sub}</p>}
        </div>
        {icon && <span className={cx('grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white', tones[tone] || tones.brand)}>{icon}</span>}
      </div>
    </div>
  );
}
