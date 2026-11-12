/** Product card used across the storefront. */
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreProvider';
import { discountOf } from '../lib/format';
import { Badge, Price, SmartImage, Stars, cx } from './ui';

export default function ProductCard({ product, compact = false }) {
  const { addToCart, toggleWishlist, isWishlisted, toggleCompare, compare, notify } = useStore();
  const navigate = useNavigate();
  if (!product) return null;

  const off = discountOf(product.mrp, product.price);
  const wished = isWishlisted(product.id);
  const compared = compare.some((p) => p.id === product.id);
  const needsVariant = Boolean(product.sizes?.length || product.colors?.length);

  const quickAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (needsVariant) {
      navigate(`/product/${product.slug}`);
      notify('Choose your size and colour', 'info');
      return;
    }
    try {
      await addToCart(product, { qty: 1 });
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-float dark:border-ink-800 dark:bg-ink-900 dark:hover:border-brand-500/50">
      <Link to={`/product/${product.slug}`} className="relative block overflow-hidden">
        <SmartImage
          src={product.images?.[0]}
          alt={product.name}
          wrapperClass={cx('w-full', compact ? 'aspect-square' : 'aspect-[4/5]')}
          className="transition duration-500 group-hover:scale-105"
        />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {off >= 20 && <Badge tone="danger">{off}% OFF</Badge>}
          {product.new_arrival && <Badge tone="info">New</Badge>}
          {product.bestseller && <Badge tone="warn">Bestseller</Badge>}
          {!product.in_stock && <Badge tone="muted">Out of stock</Badge>}
        </div>
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                await toggleWishlist(product);
              } catch (err) {
                notify(err.message, 'error');
              }
            }}
            aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={wished}
            className={cx(
              'grid h-8 w-8 place-items-center rounded-full bg-white/95 shadow-sm transition hover:scale-110 dark:bg-ink-800/95',
              wished ? 'text-rose-500' : 'text-ink-400'
            )}
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7">
              <path d="M10 16.5S3.5 12.6 3.5 8.1A3.6 3.6 0 0110 5.9a3.6 3.6 0 016.5 2.2c0 4.5-6.5 8.4-6.5 8.4z" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleCompare(product);
            }}
            aria-label={compared ? 'Remove from comparison' : 'Add to comparison'}
            className={cx('grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[10px] font-black shadow-sm transition hover:scale-110 dark:bg-ink-800/95', compared ? 'text-brand-600' : 'text-ink-400')}
          >
            ⇄
          </button>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">{product.brand}</p>
        <Link to={`/product/${product.slug}`} className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900 transition hover:text-brand-700 dark:text-white dark:hover:text-brand-300">
          {product.name}
        </Link>
        <Stars value={product.rating} count={product.review_count} />
        <Price price={product.price} mrp={product.mrp} size="sm" className="mt-auto pt-1" />
        {product.in_stock && product.stock <= 10 ? (
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Only {product.stock} left</p>
        ) : (
          <p className="text-[11px] text-ink-400">{product.delivery_days ? `Delivery in ${product.delivery_days} days` : 'Free delivery over ₹999'}</p>
        )}
        <button
          type="button"
          onClick={quickAdd}
          disabled={!product.in_stock}
          className="mt-1 w-full rounded-xl bg-ink-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400 dark:bg-white dark:text-ink-900 dark:hover:bg-brand-500 dark:hover:text-white dark:disabled:bg-ink-800 dark:disabled:text-ink-500"
        >
          {product.in_stock ? (needsVariant ? 'Select options' : 'Add to cart') : 'Out of stock'}
        </button>
      </div>
    </article>
  );
}

export function ProductRow({ products = [], title, subtitle, href, linkLabel }) {
  if (!products.length) return null;
  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink-900 sm:text-2xl dark:text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
        </div>
        {href && <Link to={href} className="text-sm font-semibold text-brand-700 dark:text-brand-300">{linkLabel || 'View all'} →</Link>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.slice(0, 5).map((p) => (
          <ProductCard key={p.id} product={p} compact />
        ))}
      </div>
    </section>
  );
}
