/**
 * Administrator dashboard.
 *
 * Every screen talks to /api/admin/* which enforces the admin role server-side, so
 * hiding a tab is never what protects the data. Sections: overview, products, orders,
 * customers, coupons, blog/vlog, support, reviews and store settings.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../context/StoreProvider';
import { dateFmt, dateTimeFmt, inr, statusTone } from '../lib/format';
import {
  Badge, Button, EmptyState, Field, Input, PageLoader, SmartImage, Textarea, cx,
} from '../components/ui';

const PANEL = 'rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900';
const TH = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400';
const TD = 'px-3 py-2 align-middle text-sm';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'products', label: 'Products', icon: '📦' },
  { id: 'orders', label: 'Orders', icon: '🧾' },
  { id: 'customers', label: 'Customers', icon: '👥' },
  { id: 'coupons', label: 'Coupons', icon: '🎟️' },
  { id: 'content', label: 'Blog & vlog', icon: '📝' },
  { id: 'support', label: 'Support', icon: '💬' },
  { id: 'reviews', label: 'Reviews', icon: '⭐' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

/* --------------------------------- shared -------------------------------- */

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/60 p-4 backdrop-blur-sm">
      <div className={cx('my-8 w-full rounded-2xl border border-ink-200 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900', wide ? 'max-w-3xl' : 'max-w-xl')}>
        <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3 dark:border-ink-800">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">✕</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, tone = 'brand' }) {
  const tones = {
    brand: 'text-brand-600 dark:text-brand-400',
    green: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  };
  return (
    <div className={PANEL}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</p>
      <p className={cx('mt-1 font-display text-2xl font-bold', tones[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  );
}

function useSection(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      setState({ data: await loader(), loading: false, error: '' });
    } catch (err) {
      setState({ data: null, loading: false, error: err.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}

/* -------------------------------- overview ------------------------------- */

function OverviewTab() {
  const { data, loading, error } = useSection(() => api.get('/admin/stats'));
  if (loading) return <PageLoader label="Loading dashboard…" />;
  if (error) return <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">{error}</p>;

  const t = data.totals;
  const maxRevenue = Math.max(1, ...data.sales_by_day.map((d) => d.revenue));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sales" value={inr(t.revenue)} hint="Paid and COD orders, excl. cancelled" tone="green" />
        <StatCard label="Orders" value={t.orders} hint={`${t.pending} awaiting fulfilment`} />
        <StatCard label="Customers" value={t.customers} hint={`${t.subscribers} newsletter subscribers`} />
        <StatCard label="Products" value={t.products} hint={`${t.low_stock} low on stock`} tone="amber" />
        <StatCard label="Completed" value={t.completed} tone="green" />
        <StatCard label="Cancelled" value={t.cancelled} tone="rose" />
        <StatCard label="Open tickets" value={t.open_tickets} tone="amber" />
        <StatCard label="Delivered value" value={inr(data.bestsellers.reduce((s, b) => s + (b.sold || 0) * b.price, 0))} hint="Top sellers, indicative" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={PANEL}>
          <h2 className="font-display text-base font-semibold">Sales · last 14 days</h2>
          <div className="mt-4 flex h-40 items-end gap-1.5">
            {data.sales_by_day.map((d) => (
              <div key={d.date} className="group flex flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition group-hover:from-brand-700"
                  style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` }}
                  title={`${dateFmt(d.date)} · ${inr(d.revenue)} · ${d.orders} orders`}
                />
                <span className="text-[9px] text-ink-400">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={PANEL}>
          <h2 className="font-display text-base font-semibold">Order status</h2>
          <ul className="mt-3 space-y-1.5">
            {data.status_breakdown.filter((s) => s.count > 0).map((s) => (
              <li key={s.status} className="flex items-center justify-between text-sm">
                <span className="text-ink-600 dark:text-ink-300">{s.status}</span>
                <Badge tone={statusTone(s.status)}>{s.count}</Badge>
              </li>
            ))}
            {!data.status_breakdown.some((s) => s.count > 0) && <li className="text-sm text-ink-500">No orders yet.</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={PANEL}>
          <h2 className="font-display text-base font-semibold">Recent orders</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={TH}>Order</th><th className={TH}>Customer</th><th className={TH}>Total</th><th className={TH}>Status</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {data.recent_orders.map((o) => (
                  <tr key={o.id}>
                    <td className={TD}><span className="font-mono text-xs">{o.order_number}</span></td>
                    <td className={TD}>{o.customer || '—'}</td>
                    <td className={TD}>{inr(o.total)}</td>
                    <td className={TD}><Badge tone={statusTone(o.status)}>{o.status}</Badge></td>
                  </tr>
                ))}
                {!data.recent_orders.length && <tr><td className={TD} colSpan={4}>No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className={PANEL}>
          <h2 className="font-display text-base font-semibold">Bestsellers</h2>
          <ul className="mt-2 space-y-2">
            {data.bestsellers.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <SmartImage src={p.image} alt={p.name} wrapperClass="h-9 w-9 shrink-0 rounded-lg" className="h-full w-full object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                <span className="text-xs text-ink-500 dark:text-ink-400">{p.sold || 0} sold</span>
              </li>
            ))}
          </ul>
          {data.low_stock.length > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Low stock</p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                {data.low_stock.map((p) => <li key={p.id}>{p.name} — {p.stock} left</li>)}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* -------------------------------- products ------------------------------- */

const BLANK_PRODUCT = {
  name: '', brand: 'ZYREX', seller: 'ZYREX Retail', category_slug: '', subcategory_slug: '',
  mrp: '', price: '', stock: '', description: '', sizes: '', colors: '', images: '',
  highlights: '', delivery_days: 4, return_days: 7, warranty: '',
  featured: false, bestseller: false, new_arrival: false,
};

function ProductForm({ product, categories, subcategories, onClose, onSaved, notify }) {
  const [form, setForm] = useState(() =>
    product
      ? {
          ...BLANK_PRODUCT,
          ...product,
          sizes: (product.sizes || []).join(', '),
          colors: (product.colors || []).join(', '),
          images: (product.images || []).join(', '),
          highlights: (product.highlights || []).join('\n'),
        }
      : BLANK_PRODUCT
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const subs = useMemo(
    () => subcategories.filter((s) => s.category_slug === form.category_slug),
    [subcategories, form.category_slug]
  );

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await api.upload(file);
      setForm((f) => ({ ...f, images: [f.images, url].filter(Boolean).join(', ') }));
      notify('Image uploaded');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      e.target.value = '';
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        ...form,
        mrp: Number(form.mrp),
        price: Number(form.price),
        stock: Number(form.stock),
        delivery_days: Number(form.delivery_days),
        return_days: Number(form.return_days),
        images: form.images.split(',').map((s) => s.trim()).filter(Boolean),
        sizes: form.sizes.split(',').map((s) => s.trim()).filter(Boolean),
        colors: form.colors.split(',').map((s) => s.trim()).filter(Boolean),
        highlights: form.highlights.split('\n').map((s) => s.trim()).filter(Boolean),
      };
      if (product) await api.patch(`/admin/products/${product.id}`, payload);
      else await api.post('/admin/products', payload);
      notify(product ? 'Product updated' : 'Product created');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">{error}</p>}
      <Field label="Product name" required><Input value={form.name} onChange={set('name')} required /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Brand"><Input value={form.brand} onChange={set('brand')} /></Field>
        <Field label="Seller"><Input value={form.seller} onChange={set('seller')} /></Field>
        <Field label="Category" required>
          <select className="w-full rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950" value={form.category_slug} onChange={set('category_slug')} required>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Subcategory">
          <select className="w-full rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950" value={form.subcategory_slug} onChange={set('subcategory_slug')}>
            <option value="">None</option>
            {subs.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="MRP (₹)" required><Input type="number" min="0" value={form.mrp} onChange={set('mrp')} required /></Field>
        <Field label="Selling price (₹)" required><Input type="number" min="1" value={form.price} onChange={set('price')} required /></Field>
        <Field label="Stock"><Input type="number" min="0" value={form.stock} onChange={set('stock')} /></Field>
        <Field label="Delivery days"><Input type="number" min="1" value={form.delivery_days} onChange={set('delivery_days')} /></Field>
        <Field label="Return window (days)"><Input type="number" min="0" value={form.return_days} onChange={set('return_days')} /></Field>
        <Field label="Warranty"><Input value={form.warranty} onChange={set('warranty')} placeholder="e.g. 1 year manufacturer" /></Field>
      </div>
      <Field label="Description"><Textarea rows={3} value={form.description} onChange={set('description')} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sizes" hint="Comma separated, e.g. S, M, L"><Input value={form.sizes} onChange={set('sizes')} /></Field>
        <Field label="Colours" hint="Comma separated"><Input value={form.colors} onChange={set('colors')} /></Field>
      </div>
      <Field label="Highlights" hint="One per line">
        <Textarea rows={3} value={form.highlights} onChange={set('highlights')} />
      </Field>
      <Field label="Image URLs" hint="Comma separated. Leave empty to use generated artwork.">
        <Textarea rows={2} value={form.images} onChange={set('images')} />
      </Field>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 px-3 py-2 text-xs font-medium dark:border-ink-700">
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} />
        ⬆ Upload image (PNG/JPEG/WebP, max 2 MB)
      </label>
      <div className="flex flex-wrap gap-4 text-xs">
        {[['featured', 'Featured'], ['bestseller', 'Bestseller'], ['new_arrival', 'New arrival']].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input type="checkbox" checked={Boolean(form[key])} onChange={set(key)} /> {label}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : product ? 'Save changes' : 'Create product'}</Button>
      </div>
    </form>
  );
}

function ProductsTab({ notify }) {
  const [query, setQuery] = useState({ q: '', category: '', low_stock: '', page: 1 });
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const { data, loading, error, reload } = useSection(() => api.get(`/admin/products?${new URLSearchParams({ ...query, low_stock: query.low_stock ? 'true' : '' })}`));
  const meta = useSection(() => api.get('/admin/categories'));

  const removeProduct = async (product) => {
    if (!window.confirm(`Delete “${product.name}”? This also clears it from carts and wishlists.`)) return;
    try {
      await api.del(`/admin/products/${product.id}`);
      notify('Product deleted');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const categories = meta.data?.categories || [];
  const subcategories = meta.data?.subcategories || [];

  return (
    <div className="space-y-4">
      <section className={PANEL}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Search" className="min-w-[180px] flex-1">
            <Input value={query.q} onChange={(e) => setQuery({ ...query, q: e.target.value, page: 1 })} placeholder="Name, brand or slug" />
          </Field>
          <Field label="Category">
            <select
              className="rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
              value={query.category}
              onChange={(e) => setQuery({ ...query, category: e.target.value, page: 1 })}
            >
              <option value="">All</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 pb-2 text-xs">
            <input type="checkbox" checked={Boolean(query.low_stock)} onChange={(e) => setQuery({ ...query, low_stock: e.target.checked ? '1' : '', page: 1 })} />
            Low stock only
          </label>
          <Button onClick={() => setCreating(true)}>+ Add product</Button>
        </div>
      </section>

      <section className={PANEL}>
        {loading && <PageLoader label="Loading products…" />}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {data && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  <th className={TH}>Product</th><th className={TH}>Category</th><th className={TH}>Price</th>
                  <th className={TH}>Stock</th><th className={TH}>Flags</th><th className={TH}>Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {data.products.map((p) => (
                    <tr key={p.id}>
                      <td className={TD}>
                        <div className="flex items-center gap-2">
                          <SmartImage src={p.images?.[0]} alt={p.name} wrapperClass="h-9 w-9 shrink-0 rounded-lg" className="h-full w-full object-cover" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="text-[11px] text-ink-500 dark:text-ink-400">{p.brand}</p>
                          </div>
                        </div>
                      </td>
                      <td className={TD}>{p.category_name}</td>
                      <td className={TD}>
                        <span className="font-semibold">{inr(p.price)}</span>
                        {p.mrp > p.price && <span className="ml-1 text-[11px] text-ink-400 line-through">{inr(p.mrp)}</span>}
                      </td>
                      <td className={TD}>
                        <Badge tone={p.stock <= 0 ? 'danger' : p.stock <= 5 ? 'warn' : 'success'}>{p.stock}</Badge>
                      </td>
                      <td className={TD}>
                        <div className="flex flex-wrap gap-1">
                          {p.featured && <Badge tone="brand">F</Badge>}
                          {p.bestseller && <Badge tone="warn">B</Badge>}
                          {p.new_arrival && <Badge tone="success">N</Badge>}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => removeProduct(p)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!data.products.length && <tr><td className={TD} colSpan={6}>No products match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
              <span>{data.total} products · page {data.page} of {data.pages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={data.page <= 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}>Prev</Button>
                <Button size="sm" variant="ghost" disabled={data.page >= data.pages} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Next</Button>
              </div>
            </div>
          </>
        )}
      </section>

      {(creating || editing) && (
        <Modal title={editing ? `Edit ${editing.name}` : 'New product'} onClose={() => { setCreating(false); setEditing(null); }} wide>
          <ProductForm
            product={editing}
            categories={categories}
            subcategories={subcategories}
            notify={notify}
            onClose={() => { setCreating(false); setEditing(null); }}
            onSaved={reload}
          />
        </Modal>
      )}
    </div>
  );
}

/* --------------------------------- orders -------------------------------- */

function OrdersTab({ notify }) {
  const [filter, setFilter] = useState({ status: '', q: '', page: 1 });
  const [open, setOpen] = useState(null);
  const { data, loading, error, reload } = useSection(() => api.get(`/admin/orders?${new URLSearchParams(filter)}`));

  const setStatus = async (order, status, note) => {
    try {
      await api.patch(`/admin/orders/${order.id}/status`, { status, note });
      notify(`Order ${order.order_number} → ${status}`);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const setPayment = async (order, payment_status) => {
    try {
      await api.patch(`/admin/orders/${order.id}/payment`, { payment_status });
      notify('Payment status updated');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <section className={PANEL}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Search" className="min-w-[180px] flex-1">
            <Input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value, page: 1 })} placeholder="Order number, name, email, phone" />
          </Field>
          <Field label="Status">
            <select className="rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value, page: 1 })}>
              <option value="">All statuses</option>
              {(data?.statuses || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className={PANEL}>
        {loading && <PageLoader label="Loading orders…" />}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className={TH}>Order</th><th className={TH}>Customer</th><th className={TH}>Placed</th>
                <th className={TH}>Total</th><th className={TH}>Payment</th><th className={TH}>Status</th><th className={TH} />
              </tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {data.orders.map((o) => (
                  <tr key={o.id} className="align-top">
                    <td className={TD}><span className="font-mono text-xs">{o.order_number}</span></td>
                    <td className={TD}>
                      <p className="font-medium">{o.address?.full_name}</p>
                      <p className="text-[11px] text-ink-500 dark:text-ink-400">{o.address?.phone}</p>
                    </td>
                    <td className={TD}><span className="text-xs">{dateFmt(o.created_at)}</span></td>
                    <td className={TD}>{inr(o.total)}</td>
                    <td className={TD}>
                      <select
                        className="rounded-lg border border-ink-300 bg-white px-2 py-1 text-xs dark:border-ink-700 dark:bg-ink-950"
                        value={o.payment_status}
                        onChange={(e) => setPayment(o, e.target.value)}
                      >
                        {['awaiting_payment', 'paid', 'cod_pending', 'failed', 'refund_pending', 'refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <p className="mt-1 text-[10px] uppercase text-ink-400">{o.payment_method}</p>
                    </td>
                    <td className={TD}><Badge tone={statusTone(o.status)}>{o.status}</Badge></td>
                    <td className={TD}>
                      <Button size="sm" variant="ghost" onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? 'Hide' : 'Manage'}</Button>
                    </td>
                  </tr>
                ))}
                {!data.orders.length && <tr><td className={TD} colSpan={7}>No orders match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {open && (() => {
        const order = data?.orders.find((o) => o.id === open);
        if (!order) return null;
        return (
          <Modal title={`Order ${order.order_number}`} onClose={() => setOpen(null)} wide>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-ink-50 p-3 text-xs dark:bg-ink-950">
                  <p className="font-semibold uppercase tracking-wide text-ink-500">Delivery address</p>
                  <p className="mt-1 whitespace-pre-line">
                    {order.address?.full_name}{'\n'}{[order.address?.line1, order.address?.line2, order.address?.landmark].filter(Boolean).join(', ')}{'\n'}{order.address?.city}, {order.address?.state} — {order.address?.pincode}{'\n'}{order.address?.phone} · {order.address?.email}
                  </p>
                  {order.address?.instructions && <p className="mt-1 italic">“{order.address.instructions}”</p>}
                </div>
                <div className="rounded-xl bg-ink-50 p-3 text-xs dark:bg-ink-950">
                  <p className="font-semibold uppercase tracking-wide text-ink-500">Payment</p>
                  <p className="mt-1">Method: {order.payment_method}</p>
                  <p>Status: {order.payment_status}</p>
                  {order.razorpay_payment_id && <p className="font-mono break-all">{order.razorpay_payment_id}</p>}
                  <p className="mt-1">Subtotal {inr(order.subtotal)} · Discount {inr(order.discount)} · Delivery {inr(order.shipping)}</p>
                  <p className="font-semibold">Total {inr(order.total)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Items</p>
                <ul className="mt-1 divide-y divide-ink-100 text-sm dark:divide-ink-800">
                  {order.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-2 py-1.5">
                      <span className="min-w-0">
                        <span className="block truncate">{it.name}</span>
                        <span className="text-[11px] text-ink-500">Qty {it.qty}{it.size ? ` · ${it.size}` : ''}{it.color ? ` · ${it.color}` : ''}</span>
                      </span>
                      <span className="font-medium">{inr(it.line_total)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Update status</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(data?.statuses || []).map((s) => (
                    <Button key={s} size="sm" variant={s === order.status ? 'primary' : 'ghost'} onClick={() => setStatus(order, s)}>{s}</Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Timeline</p>
                <ol className="mt-1 space-y-1.5 border-l border-ink-200 pl-3 text-xs dark:border-ink-800">
                  {(order.timeline || []).map((t, i) => (
                    <li key={i}>
                      <span className="font-semibold">{t.status}</span>
                      <span className="text-ink-500"> · {dateTimeFmt(t.at)}</span>
                      {t.note && <p className="text-ink-600 dark:text-ink-300">{t.note}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

/* ------------------------------- customers ------------------------------- */

function CustomersTab({ notify, currentUser }) {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useSection(() => api.get(`/admin/customers?${new URLSearchParams({ q })}`));

  const setRole = async (customer, role) => {
    try {
      await api.patch(`/admin/customers/${customer.id}/role`, { role });
      notify(`${customer.name} is now ${role === 'admin' ? 'an administrator' : 'a customer'}`);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <section className={PANEL}>
        <Field label="Search customers" className="max-w-sm">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" />
        </Field>
      </section>
      <section className={PANEL}>
        {loading && <PageLoader label="Loading customers…" />}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className={TH}>Customer</th><th className={TH}>Joined</th><th className={TH}>Orders</th>
                <th className={TH}>Spent</th><th className={TH}>Last order</th><th className={TH}>Role</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {data.customers.map((c) => (
                  <tr key={c.id}>
                    <td className={TD}>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-[11px] text-ink-500 dark:text-ink-400">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                    </td>
                    <td className={TD}><span className="text-xs">{dateFmt(c.created_at)}</span></td>
                    <td className={TD}>{c.orders}</td>
                    <td className={TD}>{inr(c.spent)}</td>
                    <td className={TD}><span className="text-xs">{c.last_order ? dateFmt(c.last_order) : '—'}</span></td>
                    <td className={TD}>
                      {c.id === currentUser?.id ? (
                        <Badge tone="brand">you</Badge>
                      ) : (
                        <select
                          className="rounded-lg border border-ink-300 bg-white px-2 py-1 text-xs dark:border-ink-700 dark:bg-ink-950"
                          value={c.role}
                          onChange={(e) => setRole(c, e.target.value)}
                        >
                          <option value="customer">customer</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
                {!data.customers.length && <tr><td className={TD} colSpan={6}>No customers found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* -------------------------------- coupons -------------------------------- */

const BLANK_COUPON = {
  code: '', description: '', type: 'percent', value: '', min_order: '', max_discount: '',
  campaign: 'Promotion', usage_limit: 500, expires_at: '', active: true,
};

function CouponsTab({ notify }) {
  const { data, loading, error, reload } = useSection(() => api.get('/admin/coupons'));
  const [form, setForm] = useState(BLANK_COUPON);
  const [busy, setBusy] = useState(false);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/admin/coupons', {
        ...form,
        value: Number(form.value),
        min_order: Number(form.min_order),
        max_discount: Number(form.max_discount),
        usage_limit: Number(form.usage_limit),
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
      });
      notify('Coupon created');
      setForm(BLANK_COUPON);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (coupon) => {
    try {
      await api.patch(`/admin/coupons/${coupon.id}`, { active: !coupon.active });
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const removeCoupon = async (coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) return;
    try {
      await api.del(`/admin/coupons/${coupon.id}`);
      notify('Coupon deleted');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className={PANEL}>
        <h2 className="font-display text-base font-semibold">Coupons & campaigns</h2>
        {loading && <PageLoader label="Loading coupons…" />}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {data && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className={TH}>Code</th><th className={TH}>Offer</th><th className={TH}>Min order</th>
                <th className={TH}>Used</th><th className={TH}>Expires</th><th className={TH}>Status</th><th className={TH} />
              </tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {data.coupons.map((c) => (
                  <tr key={c.id}>
                    <td className={TD}><span className="font-mono text-xs font-semibold">{c.code}</span><p className="text-[11px] text-ink-500">{c.campaign}</p></td>
                    <td className={TD}>
                      {c.type === 'percent' ? `${c.value}% off` : c.type === 'flat' ? `${inr(c.value)} off` : 'Free delivery'}
                      {c.max_discount > 0 && c.type === 'percent' && <span className="block text-[11px] text-ink-500">cap {inr(c.max_discount)}</span>}
                    </td>
                    <td className={TD}>{c.min_order ? inr(c.min_order) : '—'}</td>
                    <td className={TD}>{c.used_count}/{c.usage_limit}</td>
                    <td className={TD}><span className="text-xs">{dateFmt(c.expires_at)}</span></td>
                    <td className={TD}><Badge tone={c.active ? 'success' : 'neutral'}>{c.active ? 'active' : 'paused'}</Badge></td>
                    <td className={TD}>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggle(c)}>{c.active ? 'Pause' : 'Activate'}</Button>
                        <Button size="sm" variant="ghost" onClick={() => removeCoupon(c)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.coupons.length && <tr><td className={TD} colSpan={7}>No coupons yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={PANEL}>
        <h2 className="font-display text-base font-semibold">New coupon</h2>
        <form onSubmit={create} className="mt-2 space-y-2.5">
          <Field label="Code" required><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="DIWALI25" required /></Field>
          <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Type">
            <select className="w-full rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="percent">Percent off</option>
              <option value="flat">Flat amount off</option>
              <option value="shipping">Free delivery</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Value"><Input type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
            <Field label="Max discount"><Input type="number" min="0" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} /></Field>
            <Field label="Min order"><Input type="number" min="0" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} /></Field>
            <Field label="Usage limit"><Input type="number" min="1" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} /></Field>
          </div>
          <Field label="Campaign"><Input value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} /></Field>
          <Field label="Expires"><Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></Field>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Create coupon'}</Button>
        </form>
      </section>
    </div>
  );
}

/* --------------------------------- content ------------------------------- */

function ContentTab({ notify }) {
  const [kind, setKind] = useState('blog');
  const { data, loading, error, reload } = useSection(() => api.get(`/admin/${kind}`));
  const [form, setForm] = useState({ title: '', category: 'Shopping Tips', excerpt: '', body: '', youtube_id: '', description: '', duration: '' });

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/admin/${kind}`, form);
      notify(kind === 'blog' ? 'Article published' : 'Vlog published');
      setForm({ title: '', category: 'Shopping Tips', excerpt: '', body: '', youtube_id: '', description: '', duration: '' });
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const togglePublish = async (post) => {
    try {
      await api.patch(`/admin/${kind}/${post.id}`, { published: !post.published });
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const removePost = async (post) => {
    if (!window.confirm(`Delete “${post.title}”?`)) return;
    try {
      await api.del(`/admin/${kind}/${post.id}`);
      notify('Deleted');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className={PANEL}>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={kind === 'blog' ? 'primary' : 'ghost'} onClick={() => setKind('blog')}>Blog</Button>
          <Button size="sm" variant={kind === 'vlog' ? 'primary' : 'ghost'} onClick={() => setKind('vlog')}>Vlog</Button>
        </div>
        {loading && <PageLoader label="Loading posts…" />}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <ul className="mt-3 divide-y divide-ink-100 dark:divide-ink-800">
          {(data?.posts || []).map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.title}</p>
                <p className="text-[11px] text-ink-500 dark:text-ink-400">
                  {dateFmt(p.published_at || p.created_at)}{p.category ? ` · ${p.category}` : ''}
                </p>
              </div>
              <Badge tone={p.published ? 'success' : 'neutral'}>{p.published ? 'live' : 'draft'}</Badge>
              <Button size="sm" variant="ghost" onClick={() => togglePublish(p)}>{p.published ? 'Unpublish' : 'Publish'}</Button>
              <Button size="sm" variant="ghost" onClick={() => removePost(p)}>Delete</Button>
            </li>
          ))}
          {data && !data.posts.length && <li className="py-2 text-sm text-ink-500">Nothing published yet.</li>}
        </ul>
      </section>

      <section className={PANEL}>
        <h2 className="font-display text-base font-semibold">New {kind === 'blog' ? 'article' : 'vlog'}</h2>
        <form onSubmit={create} className="mt-2 space-y-2.5">
          <Field label="Title" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          {kind === 'blog' ? (
            <>
              <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
              <Field label="Excerpt"><Input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></Field>
              <Field label="Body"><Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
            </>
          ) : (
            <>
              <Field label="YouTube video ID" hint="e.g. dQw4w9WgXcQ"><Input value={form.youtube_id} onChange={(e) => setForm({ ...form, youtube_id: e.target.value })} /></Field>
              <Field label="Duration"><Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="8:24" /></Field>
              <Field label="Description"><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            </>
          )}
          <Button type="submit" className="w-full">Publish</Button>
        </form>
      </section>
    </div>
  );
}

/* --------------------------------- support ------------------------------- */

function SupportTab({ notify }) {
  const { data, loading, error, reload } = useSection(() => api.get('/admin/tickets'));
  const [reply, setReply] = useState({});

  const send = async (ticket) => {
    const message = (reply[ticket.id] || '').trim();
    if (!message) return;
    try {
      await api.patch(`/admin/tickets/${ticket.id}`, { reply: message });
      notify('Reply sent');
      setReply({ ...reply, [ticket.id]: '' });
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const setStatus = async (ticket, status) => {
    try {
      await api.patch(`/admin/tickets/${ticket.id}`, { status });
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  if (loading) return <PageLoader label="Loading tickets…" />;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  return (
    <div className="space-y-3">
      {(data?.tickets || []).map((t) => (
        <section key={t.id} className={PANEL}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-display text-sm font-semibold">{t.subject}</p>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">
                {t.name} · {t.email} · {dateTimeFmt(t.created_at)}{t.order_number ? ` · ${t.order_number}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="rounded-lg border border-ink-300 bg-white px-2 py-1 text-xs dark:border-ink-700 dark:bg-ink-950"
                value={t.status}
                onChange={(e) => setStatus(t, e.target.value)}
              >
                {['open', 'in_progress', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-line rounded-xl bg-ink-50 p-3 text-sm dark:bg-ink-950">{t.message}</p>
          {(t.replies || []).length > 0 && (
            <ul className="mt-2 space-y-1.5 border-l-2 border-brand-200 pl-3 text-xs dark:border-brand-800">
              {t.replies.map((r, i) => (
                <li key={i}><span className="font-semibold">{r.by}</span> · {dateTimeFmt(r.at)}<p className="text-ink-600 dark:text-ink-300">{r.message}</p></li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <Input value={reply[t.id] || ''} onChange={(e) => setReply({ ...reply, [t.id]: e.target.value })} placeholder="Write a reply…" className="text-xs" />
            <Button size="sm" onClick={() => send(t)}>Reply</Button>
          </div>
        </section>
      ))}
      {!data?.tickets?.length && <EmptyState icon="💬" title="No support tickets" text="Customer messages from the contact form appear here." />}
    </div>
  );
}

/* --------------------------------- reviews ------------------------------- */

function ReviewsTab({ notify }) {
  const { data, loading, error, reload } = useSection(() => api.get('/admin/reviews'));

  const removeReview = async (review) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await api.del(`/admin/reviews/${review.id}`);
      notify('Review deleted');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  if (loading) return <PageLoader label="Loading reviews…" />;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  return (
    <section className={PANEL}>
      <h2 className="font-display text-base font-semibold">Product reviews</h2>
      <ul className="mt-2 divide-y divide-ink-100 dark:divide-ink-800">
        {(data?.reviews || []).map((r) => (
          <li key={r.id} className="flex items-start gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{r.user_name}</span>{' '}
                <span className="text-amber-500">{'★'.repeat(r.rating)}<span className="text-ink-300">{'★'.repeat(5 - r.rating)}</span></span>
                <span className="text-[11px] text-ink-500"> · {dateFmt(r.created_at)}</span>
              </p>
              {r.title && <p className="text-xs font-medium">{r.title}</p>}
              <p className="text-xs text-ink-600 dark:text-ink-300">{r.body}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => removeReview(r)}>Delete</Button>
          </li>
        ))}
        {!data?.reviews?.length && <li className="py-2 text-sm text-ink-500">No reviews yet.</li>}
      </ul>
    </section>
  );
}

/* -------------------------------- settings ------------------------------- */

function SettingsTab({ notify }) {
  const { data, loading, error, reload } = useSection(() => api.get('/admin/settings'));
  const [brand, setBrand] = useState(null);
  const [commerce, setCommerce] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setBrand({
        name: '', tagline: '', announcement: '', support_email: '', support_phone: '', address: '', instagram: '', youtube: '',
        ...(data.brand || {}),
      });
      setCommerce({
        shipping_fee: 49, free_shipping_threshold: 999, cod_enabled: true, cod_limit: 50000,
        ...(data.commerce || {}),
      });
    }
  }, [data]);

  if (loading || !brand || !commerce) return <PageLoader label="Loading settings…" />;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch('/admin/settings', {
        brand,
        commerce: {
          ...commerce,
          shipping_fee: Number(commerce.shipping_fee),
          free_shipping_threshold: Number(commerce.free_shipping_threshold),
          cod_limit: Number(commerce.cod_limit),
        },
      });
      notify('Store settings saved');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4 lg:grid-cols-2">
      <section className={PANEL}>
        <h2 className="font-display text-base font-semibold">Brand</h2>
        <div className="mt-2 space-y-2.5">
          <Field label="Store name"><Input value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} /></Field>
          <Field label="Tagline"><Input value={brand.tagline} onChange={(e) => setBrand({ ...brand, tagline: e.target.value })} /></Field>
          <Field label="Announcement bar"><Input value={brand.announcement} onChange={(e) => setBrand({ ...brand, announcement: e.target.value })} /></Field>
          <Field label="Support email"><Input type="email" value={brand.support_email} onChange={(e) => setBrand({ ...brand, support_email: e.target.value })} /></Field>
          <Field label="Support phone"><Input value={brand.support_phone} onChange={(e) => setBrand({ ...brand, support_phone: e.target.value })} /></Field>
          <Field label="Business address"><Textarea rows={2} value={brand.address} onChange={(e) => setBrand({ ...brand, address: e.target.value })} /></Field>
        </div>
      </section>

      <section className={PANEL}>
        <h2 className="font-display text-base font-semibold">Delivery & payment</h2>
        <div className="mt-2 space-y-2.5">
          <Field label="Delivery fee (₹)"><Input type="number" min="0" value={commerce.shipping_fee} onChange={(e) => setCommerce({ ...commerce, shipping_fee: e.target.value })} /></Field>
          <Field label="Free delivery above (₹)"><Input type="number" min="0" value={commerce.free_shipping_threshold} onChange={(e) => setCommerce({ ...commerce, free_shipping_threshold: e.target.value })} /></Field>
          <Field label="Cash on Delivery limit (₹)"><Input type="number" min="0" value={commerce.cod_limit} onChange={(e) => setCommerce({ ...commerce, cod_limit: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(commerce.cod_enabled)} onChange={(e) => setCommerce({ ...commerce, cod_enabled: e.target.checked })} />
            Enable Cash on Delivery
          </label>
        </div>
        <Button type="submit" className="mt-3 w-full" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button>
        <p className="mt-2 text-[11px] text-ink-500 dark:text-ink-400">
          Razorpay keys and the Supabase connection are environment variables, not store settings.
        </p>
      </section>
    </form>
  );
}

/* ---------------------------------- shell -------------------------------- */

export default function Admin() {
  const { user, notify } = useStore();
  const [tab, setTab] = useState('overview');

  if (!user) {
    return <EmptyState icon="🔒" title="Administrator sign-in required" text="Sign in with an administrator account to open the dashboard." action={<Button as={Link} to="/admin/login">Admin sign in</Button>} />;
  }
  if (user.role !== 'admin') {
    return <EmptyState icon="⛔" title="Not authorised" text="This account does not have administrator access." action={<Button as={Link} to="/">Back to store</Button>} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Admin dashboard</h1>
          <p className="text-xs text-ink-500 dark:text-ink-400">Signed in as {user.name} · {user.email}</p>
        </div>
        <Button as={Link} to="/" variant="secondary" size="sm">View storefront</Button>
      </div>

      <nav className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cx(
              'shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition',
              tab === t.id
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700'
            )}
          >
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      <div className="mt-4">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'products' && <ProductsTab notify={notify} />}
        {tab === 'orders' && <OrdersTab notify={notify} />}
        {tab === 'customers' && <CustomersTab notify={notify} currentUser={user} />}
        {tab === 'coupons' && <CouponsTab notify={notify} />}
        {tab === 'content' && <ContentTab notify={notify} />}
        {tab === 'support' && <SupportTab notify={notify} />}
        {tab === 'reviews' && <ReviewsTab notify={notify} />}
        {tab === 'settings' && <SettingsTab notify={notify} />}
      </div>
    </div>
  );
}
