/** Formatting helpers shared across the storefront. */

export const inr = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(value) || 0
  );

export const compact = (value) =>
  new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0);

export const dateFmt = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

export const dateTimeFmt = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

export const deliveryDate = (value, days = 4) => {
  // Accept either a base date (e.g. an order's created_at) or a plain day count.
  const isDayCount = typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.trim()));
  const base = isDayCount ? new Date() : new Date(value || Date.now());
  const span = isDayCount ? Number(value || days) : Number(days || 4);
  if (Number.isNaN(base.getTime())) return deliveryDate(days);
  base.setDate(base.getDate() + span);
  return base.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const discountOf = (mrp, price) => (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'Z';

export const statusTone = (status) => {
  switch (status) {
    case 'Delivered':
    case 'paid':
      return 'success';
    case 'Cancelled':
    case 'failed':
      return 'danger';
    case 'Shipped':
    case 'Out for Delivery':
    case 'Processing':
    case 'Packed':
      return 'info';
    case 'Return Requested':
    case 'Refunded':
    case 'refunded':
      return 'warn';
    default:
      return 'muted';
  }
};
