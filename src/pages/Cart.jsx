/** Shopping cart: quantities, coupon, totals and checkout entry. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreProvider';
import { inr } from '../lib/format';
import {
  Badge, Breadcrumbs, Button, EmptyState, Input, QtyStepper, SmartImage, cx,
} from '../components/ui';

export default function Cart() {
  const {
    cart, coupon, user, updateQty, removeItem, clearCart, applyCoupon, removeCoupon, toggleWishlist, notify,
  } = useStore();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState('');

  const items = cart?.items || [];
  const count = cart?.count || items.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart?.subtotal || 0;
  const mrpTotal = cart?.mrp_total || items.reduce((s, i) => s + (i.mrp || i.price) * i.qty, 0);
  const savings = cart?.savings ?? Math.max(0, mrpTotal - subtotal + (cart?.discount || 0));
  const shipping = cart?.shipping || 0;
  const total = cart?.total || 0;
  const threshold = 499;
  const remaining = Math.max(0, threshold - subtotal);
  const stockIssue = items.some((i) => i.in_stock === false || (typeof i.stock === 'number' && i.qty > i.stock));

  const submitCoupon = async (e) => {
    e.preventDefault();
    setCouponError('');
    setCouponBusy(true);
    try {
      await applyCoupon(code);
      setCode('');
    } catch (err) {
      setCouponError(err.message);
    } finally {
      setCouponBusy(false);
    }
  };

  if (!items.length) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          text="Add products you like and they will show up here."
          action={<Button as={Link} to="/shop">Start shopping</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart' }]} />
      <h1 className="font-display text-2xl font-bold sm:text-3xl">
        Shopping cart <span className="text-base font-medium text-ink-500">({count} item{count > 1 ? 's' : ''})</span>
      </h1>

      {remaining > 0 && (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-200">
          Add <strong>{inr(remaining)}</strong> more to get free delivery.
          <span className="ml-2 inline-block h-1.5 w-32 overflow-hidden rounded-full bg-brand-200 align-middle dark:bg-brand-900">
            <span className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, (subtotal / threshold) * 100)}%` }} />
          </span>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-2xl border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-900"
            >
              <Link to={`/product/${item.slug}`} className="shrink-0">
                <SmartImage
                  src={item.image}
                  alt={item.name}
                  wrapperClass="h-24 w-20 rounded-xl sm:h-28 sm:w-24"
                  className="h-full w-full object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/product/${item.slug}`} className="line-clamp-2 text-sm font-semibold hover:text-brand-600">
                  {item.name}
                </Link>
                <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                  {item.brand}
                  {item.size ? ` · Size ${item.size}` : ''}
                  {item.color ? ` · ${item.color}` : ''}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-semibold">{inr(item.price)}</span>
                  {item.mrp > item.price && (
                    <span className="text-xs text-ink-400 line-through">{inr(item.mrp)}</span>
                  )}
                </div>
                {item.in_stock === false && <Badge tone="danger" className="mt-1">Out of stock</Badge>}
                {item.in_stock !== false && typeof item.stock === 'number' && item.stock < item.qty && (
                  <Badge tone="amber" className="mt-1">Only {item.stock} left</Badge>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <QtyStepper value={item.qty} onChange={(q) => updateQty(item, q)} max={Math.min(10, item.stock || 10)} />
                  <button type="button" onClick={() => removeItem(item)} className="text-xs font-semibold text-rose-600 hover:underline">
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleWishlist({
                        id: item.product_id,
                        slug: item.slug,
                        name: item.name,
                        brand: item.brand,
                        price: item.price,
                        mrp: item.mrp,
                        images: [item.image],
                        stock: item.stock,
                      });
                    }}
                    className="text-xs font-semibold text-ink-500 hover:underline dark:text-ink-400"
                  >
                    Save for later
                  </button>
                </div>
              </div>
              <div className="hidden shrink-0 text-right text-sm font-semibold sm:block">
                {inr((item.line_total ?? item.price * item.qty))}
              </div>
            </li>
          ))}
          <li className="flex justify-between pt-1">
            <Button variant="ghost" size="sm" as={Link} to="/shop">← Continue shopping</Button>
            <Button variant="ghost" size="sm" onClick={clearCart}>Clear cart</Button>
          </li>
        </ul>

        <aside className="h-max rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
          <h2 className="font-display text-base font-semibold">Order summary</h2>

          <form onSubmit={submitCoupon} className="mt-3">
            {coupon?.code ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-900/20">
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {coupon.code} applied{coupon.discount ? ` · −${inr(coupon.discount)}` : ''}
                </span>
                <button type="button" onClick={removeCoupon} className="text-xs font-semibold text-emerald-800 underline dark:text-emerald-200">
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  aria-label="Coupon code"
                />
                <Button type="submit" variant="secondary" size="sm" disabled={couponBusy || !code.trim()}>
                  {couponBusy ? '…' : 'Apply'}
                </Button>
              </div>
            )}
            {couponError && <p className="mt-2 text-xs text-rose-600">{couponError}</p>}
            {cart?.couponMessage && !couponError && (
              <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">{cart.couponMessage}</p>
            )}
          </form>

          <dl className="mt-4 space-y-2 border-t border-ink-200 pt-4 text-sm dark:border-ink-800">
            <div className="flex justify-between">
              <dt className="text-ink-500 dark:text-ink-400">MRP total</dt>
              <dd className="line-through">{inr(mrpTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500 dark:text-ink-400">Subtotal</dt>
              <dd>{inr(subtotal)}</dd>
            </div>
            {cart?.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <dt>Coupon discount</dt>
                <dd>−{inr(cart.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-500 dark:text-ink-400">Delivery</dt>
              <dd>{shipping === 0 ? <span className="text-emerald-600">FREE</span> : inr(shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-bold dark:border-ink-800">
              <dt>Total payable</dt>
              <dd>{inr(total)}</dd>
            </div>
          </dl>

          {savings > 0 && (
            <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              You save {inr(savings)} on this order
            </p>
          )}
          {stockIssue && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Some items exceed available stock. Please update quantities.
            </p>
          )}

          <Button
            className={cx('mt-4 w-full')}
            onClick={() => {
              if (stockIssue) return notify('Please fix stock issues before checkout', 'warn');
              navigate(user ? '/checkout' : '/login?next=/checkout');
            }}
          >
            {user ? 'Proceed to checkout' : 'Sign in to checkout'}
          </Button>
          <p className="mt-2 text-center text-[11px] text-ink-500 dark:text-ink-400">
            Secure checkout · Razorpay test mode · COD available
          </p>
        </aside>
      </div>
    </div>
  );
}
