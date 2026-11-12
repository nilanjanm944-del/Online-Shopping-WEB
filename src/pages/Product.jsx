/** Product detail: gallery, variants, reviews, recommendations, buy actions. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../context/StoreProvider';
import { deliveryDate, discountOf, inr } from '../lib/format';
import {
  Badge, Breadcrumbs, Button, EmptyState, Field, Input, PageLoader, Price, QtyStepper,
  Section, SmartImage, Stars, Textarea, cx,
} from '../components/ui';
import ProductCard, { ProductRow } from '../components/ProductCard';

const specEntries = (specs) => {
  if (!specs) return [];
  if (Array.isArray(specs)) {
    return specs.map((s) => [s.label || s.key || s.name || '', s.value ?? '']).filter(([k]) => k);
  }
  return Object.entries(specs).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v ?? '')]);
};

export default function Product() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, isWishlisted, addRecent, notify, user, compare, toggleCompare } = useStore();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('description');
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', body: '' });
  const [reviewError, setReviewError] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setActiveImage(0);
    setQty(1);
    api
      .get(`/products/${slug}`)
      .then((res) => {
        if (!alive) return;
        setData(res);
        setSize(res.product?.sizes?.[0] || '');
        setColor(res.product?.colors?.[0] || '');
        addRecent(res.product);
      })
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug, addRecent]);

  const product = data?.product;
  const images = useMemo(() => {
    const list = product?.images?.filter(Boolean) || [];
    return list.length ? list : [`/api/img/product/${slug}.svg?glyph=box&hue=250`];
  }, [product, slug]);

  if (loading) return <PageLoader label="Loading product…" />;
  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          icon="🔍"
          title="Product not found"
          text={error || 'This product may have been removed from the catalogue.'}
          action={<Button as={Link} to="/shop">Continue shopping</Button>}
        />
      </div>
    );
  }

  const needsSize = Boolean(product.sizes?.length);
  const needsColor = Boolean(product.colors?.length);
  const off = discountOf(product.mrp, product.price);
  const inStock = Number(product.stock) > 0;
  const saved = isWishlisted(product.id);
  const specs = specEntries(product.specs);

  const add = async (goToCheckout = false) => {
    if (needsSize && !size) return notify('Please select a size', 'warn');
    if (needsColor && !color) return notify('Please select a colour', 'warn');
    if (!inStock) return notify('This product is out of stock', 'warn');
    setBusy(true);
    try {
      await addToCart(product, { qty, size: size || null, color: color || null, silent: goToCheckout });
      if (goToCheckout) navigate('/checkout');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setReviewError('');
    setReviewBusy(true);
    try {
      await api.post(`/products/${product.slug}/reviews`, reviewForm);
      const fresh = await api.get(`/products/${product.slug}`);
      setData(fresh);
      setReviewForm({ rating: 5, title: '', body: '' });
      notify('Thanks for your review!');
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: product.category_name || 'Shop', to: `/category/${product.category}` },
          ...(product.subcategory ? [{ label: product.subcategory }] : []),
          { label: product.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* gallery */}
        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-start">
          <div className="flex-1 overflow-hidden rounded-3xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
            <SmartImage
              src={images[activeImage]}
              alt={product.name}
              wrapperClass="aspect-square"
              className="h-full w-full object-cover"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 sm:w-20 sm:flex-col">
              {images.slice(0, 6).map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={cx(
                    'overflow-hidden rounded-xl border-2',
                    i === activeImage ? 'border-brand-600' : 'border-transparent hover:border-ink-300'
                  )}
                  aria-label={`View image ${i + 1}`}
                >
                  <SmartImage src={src} alt="" wrapperClass="aspect-square w-16" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* buy box */}
        <div className="flex flex-col gap-4">
          <div>
            <Link to={`/shop?brand=${encodeURIComponent(product.brand || '')}`} className="text-sm font-semibold text-brand-600 hover:underline">
              {product.brand}
            </Link>
            <h1 className="mt-1 font-display text-2xl font-bold leading-snug sm:text-3xl">{product.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
              <Stars value={product.rating} count={product.review_count} />
              <span>·</span>
              <span>{product.seller || 'ZYREX verified seller'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
            <Price price={product.price} mrp={product.mrp} size="lg" />
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Inclusive of all taxes{off > 0 ? ` · You save ${inr(product.mrp - product.price)} (${off}% off)` : ''}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {inStock ? (
                <Badge tone="success">In stock{product.stock < 10 ? ` · only ${product.stock} left` : ''}</Badge>
              ) : (
                <Badge tone="danger">Out of stock</Badge>
              )}
              {product.bestseller && <Badge tone="amber">Bestseller</Badge>}
              {product.new_arrival && <Badge tone="brand">New arrival</Badge>}
              {product.cod_available !== false && <Badge tone="neutral">COD available</Badge>}
            </div>
            <p className="mt-3 text-sm">
              <span className="font-semibold">Delivery by {deliveryDate(product.delivery_days)}</span>
              <span className="text-ink-500 dark:text-ink-400"> · Free over {inr(499)}</span>
            </p>
            <p className="text-sm text-ink-500 dark:text-ink-400">
              {product.return_days ? `${product.return_days}-day easy return & replacement` : 'Return policy as per category'}
            </p>
          </div>

          {needsSize && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Select size</span>
                <span className="text-xs text-ink-500 dark:text-ink-400">Size guide: regular fit</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={cx(
                      'min-w-11 rounded-xl border px-3 py-2 text-sm font-semibold',
                      size === s
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-ink-200 hover:border-brand-400 dark:border-ink-700'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needsColor && (
            <div>
              <span className="mb-2 block text-sm font-semibold">Select colour</span>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cx(
                      'rounded-xl border px-3 py-2 text-sm font-semibold',
                      color === c
                        ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200'
                        : 'border-ink-200 hover:border-brand-400 dark:border-ink-700'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">Qty</span>
            <QtyStepper value={qty} onChange={setQty} max={Math.min(10, Number(product.stock) || 10)} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => add(false)} disabled={busy || !inStock} className="flex-1">
              {busy ? 'Adding…' : 'Add to cart'}
            </Button>
            <Button variant="secondary" onClick={() => add(true)} disabled={busy || !inStock} className="flex-1">
              Buy now
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => toggleWishlist(product)}>
              {saved ? '♥ Saved to wishlist' : '♡ Add to wishlist'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toggleCompare(product)}>
              {compare.some((p) => p.id === product.id) ? 'Remove from compare' : 'Compare'}
            </Button>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-10 rounded-3xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
        <div className="flex gap-1 overflow-x-auto border-b border-ink-200 p-2 dark:border-ink-800">
          {[
            ['description', 'Description'],
            ['specs', 'Specifications'],
            ['reviews', `Reviews (${product.review_count || 0})`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cx(
                'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold',
                tab === key ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'description' && (
            <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-ink-700 dark:text-ink-300">
              <p>{product.description}</p>
              {Array.isArray(product.highlights) && product.highlights.length > 0 && (
                <ul className="list-disc space-y-1 pl-5">
                  {product.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              {(product.material || product.fit || product.pattern || product.care) && (
                <dl className="grid gap-2 sm:grid-cols-2">
                  {[
                    ['Material', product.material],
                    ['Fit', product.fit],
                    ['Pattern', product.pattern],
                    ['Care', product.care],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="font-semibold">{k}:</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </div>
          )}

          {tab === 'specs' && (
            <div className="max-w-3xl overflow-hidden rounded-2xl border border-ink-200 dark:border-ink-800">
              <table className="w-full text-sm">
                <tbody>
                  {specs.length === 0 && (
                    <tr>
                      <td className="px-4 py-3 text-ink-500">No specifications listed for this product.</td>
                    </tr>
                  )}
                  {specs.map(([k, v], i) => (
                    <tr key={k} className={i % 2 ? 'bg-ink-50 dark:bg-ink-900/60' : ''}>
                      <th className="w-1/3 px-4 py-3 text-left font-semibold text-ink-600 dark:text-ink-300">{k}</th>
                      <td className="px-4 py-3">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'reviews' && (
            <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div>
                <div className="flex items-end gap-3">
                  <span className="font-display text-4xl font-bold">{Number(product.rating || 0).toFixed(1)}</span>
                  <div className="pb-1">
                    <Stars value={product.rating} size="md" />
                    <p className="text-xs text-ink-500">{product.review_count || 0} ratings</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const n = Number(product.rating_breakdown?.[star] || 0);
                    const total = Object.values(product.rating_breakdown || {}).reduce((s, v) => s + Number(v || 0), 0) || 1;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-3">{star}</span>
                        <span className="text-amber-500">★</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800">
                          <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(n / total) * 100}%` }} />
                        </span>
                        <span className="w-8 text-right text-ink-500">{n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                {user ? (
                  <form onSubmit={submitReview} className="rounded-2xl border border-ink-200 p-4 dark:border-ink-800">
                    <h3 className="font-display text-base font-semibold">Write a review</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                      <Field label="Rating">
                        <select
                          value={reviewForm.rating}
                          onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                          className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-900"
                        >
                          {[5, 4, 3, 2, 1].map((r) => (
                            <option key={r} value={r}>{r} star{r > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Title">
                        <Input
                          value={reviewForm.title}
                          onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                          placeholder="Great quality for the price"
                        />
                      </Field>
                    </div>
                    <Field label="Your review" className="mt-3" hint="At least 10 characters.">
                      <Textarea
                        value={reviewForm.body}
                        onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })}
                        placeholder="What did you like or dislike?"
                        required
                        minLength={10}
                      />
                    </Field>
                    {reviewError && <p className="mt-2 text-sm text-rose-600">{reviewError}</p>}
                    <Button type="submit" size="sm" className="mt-3" disabled={reviewBusy}>
                      {reviewBusy ? 'Submitting…' : 'Submit review'}
                    </Button>
                  </form>
                ) : (
                  <p className="rounded-2xl border border-dashed border-ink-200 p-4 text-sm text-ink-600 dark:border-ink-800 dark:text-ink-300">
                    <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link> to write a review.
                  </p>
                )}

                {(data.reviews || []).length === 0 ? (
                  <p className="text-sm text-ink-500">No customer reviews yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.reviews.map((r) => (
                      <li key={r.id} className="rounded-2xl border border-ink-200 p-4 dark:border-ink-800">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{r.author || 'Customer'}</span>
                          <Stars value={r.rating} />
                        </div>
                        <p className="mt-1 text-sm font-medium">{r.title}</p>
                        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{r.body}</p>
                        {r.verified && <Badge tone="success" className="mt-2">Verified purchase</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {(data.frequently_bought || []).length > 0 && (
        <div className="mt-10">
          <Section title="Frequently bought together" subtitle="Complete the set and save on delivery">
            <ProductRow products={data.frequently_bought} />
          </Section>
        </div>
      )}

      {(data.related || []).length > 0 && (
        <div className="mt-10">
          <Section title="Related products" subtitle={`More from ${product.category_name || 'this category'}`} href="/shop">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {data.related.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </Section>
        </div>
      )}

      {(data.also_viewed || []).length > 0 && (
        <div className="mt-10">
          <Section title="Customers also viewed" subtitle="Based on this product's category">
            <ProductRow products={data.also_viewed} />
          </Section>
        </div>
      )}
    </div>
  );
}
