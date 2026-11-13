/**
 * Checkout: address, delivery/payment choice, coupon and Razorpay test-mode flow.
 *
 * The server recalculates every amount and verifies the gateway signature, so a
 * browser can never confirm a payment on its own. If Razorpay keys are absent the
 * page explains exactly what to configure instead of faking a success screen.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../context/StoreProvider';
import { inr } from '../lib/format';
import {
  Badge, Breadcrumbs, Button, EmptyState, Field, Input, PageLoader, SmartImage, Textarea, cx,
} from '../components/ui';

const EMPTY_ADDRESS = {
  full_name: '',
  phone: '',
  email: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  instructions: '',
};

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep',
  'Puducherry',
];

/** Loads the Razorpay checkout script once and resolves when ready. */
function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const existing = document.querySelector('script[data-razorpay]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay));
      existing.addEventListener('error', () => reject(new Error('Could not load the Razorpay checkout script.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpay = 'true';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Could not load the Razorpay checkout script.'));
    document.body.appendChild(script);
  });
}

export default function Checkout() {
  const { cart, coupon, applyCoupon, removeCoupon, user, notify, refreshCart, clearCart, brand } = useStore();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState('new');
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);
  const [config, setConfig] = useState(null);
  const [method, setMethod] = useState('razorpay');
  const [code, setCode] = useState(coupon?.code || '');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const idempotencyKey = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `k${Date.now()}`
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [addr, cfg] = await Promise.all([
          api.get('/auth/addresses').catch(() => ({ addresses: [] })),
          api.get('/payments/config'),
        ]);
        if (!alive) return;
        const list = addr.addresses || [];
        setAddresses(list);
        const preferred = list.find((a) => a.is_default) || list[0];
        if (preferred) setSelectedAddress(preferred.id);
        setConfig(cfg);
        if (!cfg.razorpay?.configured) {
          if (cfg.sandbox?.enabled) setMethod('sandbox');
          else if (cfg.cod_enabled) setMethod('cod');
        }
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, full_name: f.full_name || user.name || '', email: f.email || user.email || '', phone: f.phone || user.phone || '' }));
  }, [user]);

  const chosen = useMemo(() => addresses.find((a) => a.id === selectedAddress) || null, [addresses, selectedAddress]);
  const codAvailable = Boolean(config?.cod_enabled) && cart.total <= (config?.cod_limit || Infinity);
  const razorpayReady = Boolean(config?.razorpay?.configured);
  const sandboxReady = Boolean(config?.sandbox?.enabled);

  if (loading) return <PageLoader label="Preparing checkout…" />;

  if (!cart.items.length) {
    return (
      <EmptyState
        icon="🛒"
        title="Your cart is empty"
        text="Add a few products before checking out."
        action={<Button as={Link} to="/shop">Browse products</Button>}
      />
    );
  }

  const applyCode = async () => {
    try {
      await applyCoupon(code);
      notify('Coupon applied');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const placeOrder = async () => {
    setError('');
    const address = chosen ? { ...chosen } : { ...form };
    setBusy(true);
    try {
      if (!chosen && saveAddress) {
        try {
          await api.post('/auth/addresses', { ...form, is_default: addresses.length === 0 });
        } catch {
          /* Saving the address is a convenience; the order can still proceed. */
        }
      }

      const { order } = await api.post('/orders', {
        address,
        payment_method: method,
        coupon_code: coupon?.code || null,
        idempotency_key: idempotencyKey.current,
      });

      if (method === 'cod') {
        await refreshCart();
        notify('Order placed successfully');
        navigate(`/account/orders/${order.id}`, { replace: true });
        return;
      }

      // Test-mode payment: the server records the outcome and confirms the order.
      if (method === 'sandbox') {
        await api.post('/payments/sandbox/confirm', { order_id: order.id, outcome: 'success' });
        await refreshCart();
        notify('Test payment approved — order confirmed. No money was charged.');
        navigate(`/account/orders/${order.id}`, { replace: true });
        return;
      }

      // Online payment: create the gateway order, then verify the signature server-side.
      const init = await api.post('/payments/razorpay/order', { order_id: order.id });
      const Razorpay = await loadRazorpay();
      const checkout = new Razorpay({
        key: init.key_id,
        amount: init.amount,
        currency: init.currency,
        name: init.name || brand?.name || 'ZYREX STORE',
        description: `Order ${init.order_number}`,
        order_id: init.razorpay_order_id,
        prefill: init.prefill,
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: async () => {
            try {
              await api.post('/payments/razorpay/failed', { order_id: order.id });
            } catch {
              /* The order stays pending; the customer can retry from order details. */
            }
            await refreshCart();
            notify('Payment cancelled. Stock has been released.', 'error');
            navigate(`/account/orders/${order.id}`, { replace: true });
          },
        },
        handler: async (response) => {
          try {
            await api.post('/payments/razorpay/verify', {
              order_id: order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await refreshCart();
            notify('Payment verified. Your order is confirmed.');
          } catch (err) {
            notify(err.message, 'error');
          } finally {
            navigate(`/account/orders/${order.id}`, { replace: true });
          }
        },
      });
      checkout.on('payment.failed', async () => {
        try {
          await api.post('/payments/razorpay/failed', { order_id: order.id });
        } catch {
          /* ignore — order remains pending for retry */
        }
        notify('Payment failed. No money was captured.', 'error');
      });
      checkout.open();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (key) => ({
    id: `co-${key}`,
    name: key,
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />
      <h1 className="font-display text-2xl font-bold">Checkout</h1>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* ------------------------------ address ------------------------------ */}
          <section className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">1. Delivery address</h2>
              {addresses.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setSelectedAddress('new')}>+ New address</Button>
              )}
            </div>

            {addresses.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className={cx(
                      'cursor-pointer rounded-xl border p-3 text-sm transition',
                      selectedAddress === a.id
                        ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20'
                        : 'border-ink-200 hover:border-brand-300 dark:border-ink-700'
                    )}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={selectedAddress === a.id}
                      onChange={() => setSelectedAddress(a.id)}
                    />
                    <span className="flex items-center justify-between font-semibold">
                      {a.full_name}
                      {a.is_default && <Badge tone="brand">Default</Badge>}
                    </span>
                    <span className="mt-1 block text-xs text-ink-600 dark:text-ink-300">
                      {[a.line1, a.line2, a.landmark].filter(Boolean).join(', ')}<br />
                      {a.city}, {a.state} — {a.pincode}<br />
                      {a.phone}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {selectedAddress === 'new' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Full name" required><Input {...field('full_name')} autoComplete="name" required /></Field>
                <Field label="Mobile number" required><Input {...field('phone')} inputMode="numeric" placeholder="10-digit number" required /></Field>
                <Field label="Email" required className="sm:col-span-2"><Input type="email" {...field('email')} autoComplete="email" required /></Field>
                <Field label="Address line 1" required className="sm:col-span-2"><Input {...field('line1')} placeholder="House / flat, street" required /></Field>
                <Field label="Address line 2"><Input {...field('line2')} placeholder="Area, locality" /></Field>
                <Field label="Landmark"><Input {...field('landmark')} /></Field>
                <Field label="City" required><Input {...field('city')} required /></Field>
                <Field label="State" required>
                  <select
                    id="co-state"
                    name="state"
                    className="w-full rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-ink-700 dark:bg-ink-950 dark:focus:ring-brand-900"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    required
                  >
                    <option value="">Select state</option>
                    {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="PIN code" required><Input {...field('pincode')} inputMode="numeric" maxLength={6} required /></Field>
                <Field label="Delivery instructions" className="sm:col-span-2">
                  <Textarea rows={2} {...field('instructions')} placeholder="e.g. Call before delivery" />
                </Field>
                <label className="flex items-center gap-2 text-xs text-ink-600 sm:col-span-2 dark:text-ink-300">
                  <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                  Save this address to my account
                </label>
              </div>
            )}
          </section>

          {/* ------------------------------ payment ------------------------------ */}
          <section className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
            <h2 className="font-display text-base font-semibold">2. Payment method</h2>

            {!razorpayReady && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                {sandboxReady
                  ? 'Razorpay is not connected, so live card/UPI payments are off. Test-mode payment is available below: it completes the full order and payment flow so you can check the store, and no money is charged.'
                  : 'Online payment is not active yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Settings → Environment variables to enable Razorpay. Card, UPI and net banking run through the gateway — this store never sees them.'}
              </p>
            )}

            <div className="mt-3 space-y-2">
              <label className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm', method === 'razorpay' ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20' : 'border-ink-200 dark:border-ink-700', !razorpayReady && 'opacity-60')}>
                <input
                  type="radio"
                  name="pay"
                  className="mt-1"
                  checked={method === 'razorpay'}
                  disabled={!razorpayReady}
                  onChange={() => setMethod('razorpay')}
                />
                <span>
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    UPI · Cards · Net banking
                    {config?.razorpay?.mode && <Badge tone={config.razorpay.mode === 'live' ? 'success' : 'warn'}>{config.razorpay.mode} mode</Badge>}
                  </span>
                  <span className="text-xs text-ink-600 dark:text-ink-300">
                    Secure Razorpay checkout. Signature verified on our server before the order is confirmed.
                  </span>
                </span>
              </label>

              {sandboxReady && (
                <label className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm', method === 'sandbox' ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20' : 'border-ink-200 dark:border-ink-700')}>
                  <input
                    type="radio"
                    name="pay"
                    className="mt-1"
                    checked={method === 'sandbox'}
                    onChange={() => setMethod('sandbox')}
                  />
                  <span>
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      Test payment (no money charged)
                      <Badge tone="warn">test mode</Badge>
                    </span>
                    <span className="block text-xs text-ink-600 dark:text-ink-300">
                      Runs the complete payment flow — order, confirmation and timeline — so you can verify checkout
                      before Razorpay is connected. No card details are collected.
                    </span>
                  </span>
                </label>
              )}

              <label className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm', method === 'cod' ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20' : 'border-ink-200 dark:border-ink-700', !codAvailable && 'opacity-60')}>
                <input
                  type="radio"
                  name="pay"
                  className="mt-1"
                  checked={method === 'cod'}
                  disabled={!codAvailable}
                  onChange={() => setMethod('cod')}
                />
                <span>
                  <span className="font-semibold">Cash on Delivery</span>
                  <span className="block text-xs text-ink-600 dark:text-ink-300">
                    {config?.cod_enabled
                      ? `Available up to ${inr(config.cod_limit)} per order.`
                      : 'Cash on Delivery is currently disabled by the store.'}
                  </span>
                </span>
              </label>
            </div>
          </section>
        </div>

        {/* -------------------------------- summary -------------------------------- */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
            <h2 className="font-display text-base font-semibold">Order summary</h2>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {cart.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <SmartImage src={item.image} alt={item.name} wrapperClass="h-12 w-12 shrink-0 rounded-lg" className="h-full w-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{item.name}</p>
                    <p className="text-[11px] text-ink-500 dark:text-ink-400">
                      Qty {item.qty}{item.size ? ` · ${item.size}` : ''}{item.color ? ` · ${item.color}` : ''}
                    </p>
                  </div>
                  <p className="text-xs font-semibold">{inr(item.line_total)}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 border-t border-ink-200 pt-3 dark:border-ink-800">
              {coupon ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs dark:bg-emerald-900/20">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">{coupon.code} applied</span>
                  <button type="button" onClick={removeCoupon} className="font-semibold text-rose-600 hover:underline">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code" className="text-xs" />
                  <Button size="sm" variant="secondary" onClick={applyCode}>Apply</Button>
                </div>
              )}
            </div>

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-600 dark:text-ink-300">Subtotal</dt><dd>{inr(cart.subtotal)}</dd></div>
              {cart.discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><dt>Discount</dt><dd>−{inr(cart.discount)}</dd></div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-600 dark:text-ink-300">Delivery</dt>
                <dd>{cart.shipping ? inr(cart.shipping) : <span className="font-semibold text-emerald-600">Free</span>}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-2 font-display text-base font-bold dark:border-ink-800">
                <dt>Payable</dt><dd>{inr(cart.total)}</dd>
              </div>
              {cart.savings > 0 && (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">You save {inr(cart.savings)}</p>
              )}
            </dl>

            {error && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">{error}</p>
            )}

            <Button className="mt-4 w-full" onClick={placeOrder} disabled={busy || (method === 'razorpay' && !razorpayReady) || (method === 'cod' && !codAvailable) || (method === 'sandbox' && !sandboxReady)}>
              {busy
                ? 'Placing order…'
                : method === 'cod'
                  ? `Place order · ${inr(cart.total)}`
                  : method === 'sandbox'
                    ? `Pay ${inr(cart.total)} in test mode`
                    : `Pay ${inr(cart.total)} securely`}
            </Button>
            <p className="mt-2 text-center text-[11px] text-ink-500 dark:text-ink-400">
              Prices and stock are re-checked on the server before the order is created.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
