/** Order history, order detail with timeline, and public order tracking. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../context/StoreProvider';
import { dateFmt, dateTimeFmt, deliveryDate, inr, statusTone } from '../lib/format';
import {
  Badge, Breadcrumbs, Button, EmptyState, Field, Input, Modal, PageLoader, SmartImage, Textarea, cx,
} from '../components/ui';

const STATUS_TONE = {
  'Order Placed': 'brand',
  'Payment Confirmed': 'brand',
  Processing: 'warn',
  Packed: 'warn',
  Shipped: 'brand',
  'Out for Delivery': 'brand',
  Delivered: 'success',
  Cancelled: 'danger',
  'Return Requested': 'warn',
  Refunded: 'success',
};

const PAYMENT_LABEL = {
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
  cod: 'Cash on Delivery',
};

function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || 'neutral'}>{status}</Badge>;
}

function Timeline({ timeline = [] }) {
  return (
    <ol className="relative space-y-4 border-l border-ink-200 pl-5 dark:border-ink-700">
      {timeline.map((step, i) => (
        <li key={i} className="relative">
          <span
            className={cx(
              'absolute -left-[26px] top-1 grid h-3 w-3 place-items-center rounded-full ring-4',
              i === timeline.length - 1
                ? 'bg-brand-600 ring-brand-100 dark:ring-brand-900/40'
                : 'bg-ink-300 ring-white dark:bg-ink-600 dark:ring-ink-900'
            )}
          />
          <p className="text-sm font-semibold">{step.status}</p>
          {step.note && <p className="text-xs text-ink-600 dark:text-ink-300">{step.note}</p>}
          <p className="mt-0.5 text-[11px] text-ink-400">{dateTimeFmt(step.at)}</p>
        </li>
      ))}
    </ol>
  );
}

export function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useStore();

  useEffect(() => {
    api
      .get('/orders')
      .then((res) => setOrders(res.orders || []))
      .catch((err) => notify(err.message, 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <PageLoader />;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon="🛍️"
        title="No orders yet"
        text="When you place your first order it will appear here with live tracking."
        action={<Button as={Link} to="/shop">Start shopping</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold">My orders</h1>
      {orders.map((order) => (
        <article key={order.id} className="rounded-2xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3 text-sm dark:border-ink-800">
            <div>
              <p className="font-semibold">#{order.order_number}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Placed {dateFmt(order.created_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status} />
              <Badge tone={order.payment_status === 'paid' ? 'success' : 'neutral'}>
                {PAYMENT_LABEL[order.payment_status] || order.payment_status}
              </Badge>
            </div>
          </div>
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {order.items.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <SmartImage src={item.image} alt={item.name} wrapperClass="h-14 w-14 shrink-0 rounded-lg" className="h-full w-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    Qty {item.qty}
                    {item.size ? ` · ${item.size}` : ''}
                    {item.color ? ` · ${item.color}` : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold">{inr(item.line_total)}</p>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="px-4 py-2 text-xs text-ink-500 dark:text-ink-400">+{order.items.length - 3} more item(s)</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-3 dark:border-ink-800">
            <p className="text-sm">
              Total <span className="font-display font-bold">{inr(order.total)}</span>
            </p>
            <Button as={Link} to={`/account/orders/${order.id}`} variant="secondary" size="sm">
              View details
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const { notify } = useStore();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // 'cancel' | 'return'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cancellable = order && ['Order Placed', 'Payment Confirmed', 'Processing'].includes(order.status);
  const returnable = order && order.status === 'Delivered';

  const act = async () => {
    setBusy(true);
    try {
      const path = dialog === 'cancel' ? `/orders/${order.id}/cancel` : `/orders/${order.id}/return`;
      await api.post(path, { reason });
      setDialog(null);
      setReason('');
      await load();
      notify(dialog === 'cancel' ? 'Order cancelled' : 'Return requested');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error || !order) {
    return <EmptyState icon="📦" title="Order not found" text={error} action={<Button as={Link} to="/account/orders">Back to orders</Button>} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: 'Account', to: '/account' }, { label: 'Orders', to: '/account/orders' }, { label: `#${order.order_number}` }]} />
          <h1 className="font-display text-xl font-bold">Order #{order.order_number}</h1>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">Placed on {dateFmt(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {cancellable && <Button variant="danger" size="sm" onClick={() => setDialog('cancel')}>Cancel order</Button>}
          {returnable && <Button variant="secondary" size="sm" onClick={() => setDialog('return')}>Request return</Button>}
          <Button as={Link} to={`/track?order=${order.order_number}`} variant="ghost" size="sm">Track order</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">Items</h2>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-3 divide-y divide-ink-100 dark:divide-ink-800">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <SmartImage src={item.image} alt={item.name} wrapperClass="h-16 w-16 shrink-0 rounded-lg" className="h-full w-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/product/${item.slug}`} className="line-clamp-2 text-sm font-medium hover:text-brand-600">{item.name}</Link>
                    <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                      {item.brand} · Qty {item.qty}
                      {item.size ? ` · Size ${item.size}` : ''}
                      {item.color ? ` · ${item.color}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{inr(item.line_total)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
            <h2 className="font-display text-base font-semibold">Order timeline</h2>
            <div className="mt-3">
              <Timeline timeline={order.timeline} />
            </div>
            {order.cancel_reason && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                Cancellation reason: {order.cancel_reason}
              </p>
            )}
            {order.return_reason && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                Return reason: {order.return_reason}
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-ink-200 bg-white p-4 text-sm dark:border-ink-800 dark:bg-ink-900">
            <h2 className="font-display text-base font-semibold">Payment summary</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between"><dt className="text-ink-600 dark:text-ink-300">Subtotal</dt><dd>{inr(order.subtotal)}</dd></div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <dt>Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</dt><dd>−{inr(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between"><dt className="text-ink-600 dark:text-ink-300">Delivery</dt><dd>{order.shipping ? inr(order.shipping) : 'Free'}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-2 font-display text-base font-bold dark:border-ink-800">
                <dt>Total</dt><dd>{inr(order.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
              Method: {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Razorpay (online)'}<br />
              Status: {PAYMENT_LABEL[order.payment_status] || order.payment_status}
              {order.razorpay_payment_id && <><br />Txn: {order.razorpay_payment_id}</>}
            </p>
          </section>

          <section className="rounded-2xl border border-ink-200 bg-white p-4 text-sm dark:border-ink-800 dark:bg-ink-900">
            <h2 className="font-display text-base font-semibold">Delivery address</h2>
            <p className="mt-2 text-ink-600 dark:text-ink-300">
              <span className="font-semibold text-ink-900 dark:text-white">{order.address?.full_name}</span><br />
              {[order.address?.line1, order.address?.line2, order.address?.landmark].filter(Boolean).join(', ')}<br />
              {order.address?.city}, {order.address?.state} — {order.address?.pincode}<br />
              {order.address?.phone}
            </p>
            {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
              <p className="mt-2 text-xs font-semibold text-brand-600">Expected by {deliveryDate(order.created_at)}</p>
            )}
            {order.address?.instructions && (
              <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">Instructions: {order.address.instructions}</p>
            )}
          </section>
        </aside>
      </div>

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog === 'cancel' ? 'Cancel this order' : 'Request a return'}
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          {dialog === 'cancel'
            ? 'Stock is restored immediately. Prepaid amounts are marked for refund.'
            : 'Tell us what went wrong. Our team arranges a pickup after approval.'}
        </p>
        <Field label="Reason" className="mt-3" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} minLength={5} required />
        </Field>
        <div className="mt-3 flex gap-2">
          <Button onClick={act} disabled={busy || reason.trim().length < 5} variant={dialog === 'cancel' ? 'danger' : 'primary'}>
            {busy ? 'Submitting…' : dialog === 'cancel' ? 'Confirm cancellation' : 'Submit request'}
          </Button>
          <Button variant="ghost" onClick={() => setDialog(null)}>Keep order</Button>
        </div>
      </Modal>
    </div>
  );
}

export function Track() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [form, setForm] = useState({ order_number: params.get('order') || '', email: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { user } = useStore();

  const lookup = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const q = form.email.trim() ? `?email=${encodeURIComponent(form.email.trim())}` : '';
      const res = await api.get(`/track/${encodeURIComponent(form.order_number.trim())}${q}`);
      setResult(res.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const steps = useMemo(() => result?.timeline || [], [result]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Track order' }]} />
      <h1 className="font-display text-2xl font-bold">Track your order</h1>
      <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
        Enter your order number and the email used at checkout.{user ? ' As you are signed in, the email is optional.' : ''}
      </p>

      <form onSubmit={lookup} className="mt-5 grid gap-3 rounded-2xl border border-ink-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] dark:border-ink-800 dark:bg-ink-900">
        <Field label="Order number" required>
          <Input value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} placeholder="ZRX-000000-0000" required />
        </Field>
        <Field label="Email used at checkout">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
        </Field>
        <div className="flex items-end">
          <Button type="submit" className="w-full sm:w-auto" disabled={busy}>{busy ? 'Checking…' : 'Track'}</Button>
        </div>
      </form>

      {error && (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">{error}</p>
      )}

      {result && (
        <div className="mt-5 rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-lg font-bold">#{result.order_number}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Placed {dateFmt(result.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <StatusBadge status={result.status} />
              <Badge tone={result.payment_status === 'paid' ? 'success' : 'neutral'}>
                {PAYMENT_LABEL[result.payment_status] || result.payment_status}
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <Timeline timeline={steps} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-ink-200 pt-3 text-sm dark:border-ink-800">
            <span className="text-ink-600 dark:text-ink-300">{result.items.length} item(s)</span>
            <span className="font-display font-bold">{inr(result.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
