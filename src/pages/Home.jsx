/** Storefront homepage: hero, categories, deals, curated rails and content previews. */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, imageUrl } from '../lib/api';
import { useStore } from '../context/StoreProvider';
import { Badge, Button, EmptyState, PageLoader, Section, SmartImage, Stars } from '../components/ui';
import ProductCard, { ProductRow } from '../components/ProductCard';
import { inr } from '../lib/format';

const TRUST = [
  { icon: '🚚', title: 'Free delivery over ₹999', text: 'Pan-India shipping in 2–6 days' },
  { icon: '↩️', title: '7-day easy returns', text: 'Simple returns on eligible items' },
  { icon: '🔒', title: 'Secure payments', text: 'UPI, cards, net banking and COD' },
  { icon: '💬', title: 'Real human support', text: 'Mon–Sat, 9 AM – 8 PM IST' },
];

const TESTIMONIALS = [
  { name: 'Ananya S.', city: 'Kolkata', text: 'The kurti set arrived in two days and the fabric quality matched the photos exactly. Checkout with UPI took seconds.', rating: 5 },
  { name: 'Rahul M.', city: 'Bengaluru', text: 'Ordered headphones during the sale. Prices were genuinely lower than the usual marketplace and delivery tracking was accurate.', rating: 5 },
  { name: 'Priya D.', city: 'Pune', text: 'Bought a mixer grinder and kitchen storage together. Packaging was solid and the return window gave me confidence.', rating: 4 },
];

function Countdown() {
  const [left, setLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const diff = Math.max(0, end - Date.now());
      const h = String(Math.floor(diff / 3.6e6)).padStart(2, '0');
      const m = String(Math.floor((diff % 3.6e6) / 6e4)).padStart(2, '0');
      const s = String(Math.floor((diff % 6e4) / 1000)).padStart(2, '0');
      setLeft(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1 font-mono text-xs font-bold text-white dark:bg-white dark:text-ink-900">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" /> Ends in {left}
    </span>
  );
}

export default function Home() {
  const { user, recent, settings, commerce } = useStore();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [posts, setPosts] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get('/categories'),
      api.get('/products?limit=60&sort=popularity'),
      api.get('/products?deals=true&limit=10'),
      api.get('/blog?limit=3'),
      api.get('/recommendations').catch(() => ({ products: [] })),
    ])
      .then(([cats, all, dealRes, blogRes, recRes]) => {
        if (!alive) return;
        setCategories(cats.categories || []);
        setProducts(all.products || []);
        setDeals(dealRes.products || []);
        setPosts(blogRes.posts || []);
        setRecommended(recRes.products || []);
      })
      .catch(() => null)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const featured = useMemo(() => products.filter((p) => p.featured), [products]);
  const bestsellers = useMemo(() => products.filter((p) => p.bestseller), [products]);
  const newArrivals = useMemo(() => products.filter((p) => p.new_arrival), [products]);
  const trending = useMemo(() => [...products].sort((a, b) => b.rating - a.rating).slice(0, 10), [products]);

  const collections = useMemo(
    () =>
      categories.slice(0, 4).map((c) => ({
        category: c,
        items: products.filter((p) => p.category_slug === c.slug).slice(0, 5),
      })),
    [categories, products]
  );

  if (loading) return <PageLoader label="Loading the storefront…" />;

  const hero = featured.slice(0, 3);

  return (
    <div className="space-y-12 pb-8">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-accent-600 px-6 py-10 text-white shadow-float sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-2">
            <div>
              <Badge tone="neutral" className="bg-white/15 text-white">Festive season · up to 55% off</Badge>
              <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
                Everything you need,<br /> in one premium marketplace.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/85 sm:text-base">
                Fashion, electronics, home & kitchen, grocery, beauty, books, toys and more — curated from trusted sellers with secure payments and easy returns across India.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/shop" className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-brand-50">Start shopping</Link>
                <Link to="/deals" className="rounded-xl border border-white/40 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">Today’s deals</Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/80">
                <span>✓ {commerce?.free_shipping_threshold ? `Free delivery over ${inr(commerce.free_shipping_threshold)}` : 'Free delivery available'}</span>
                <span>✓ 7-day returns</span>
                <span>✓ {settings?.payments?.enabled ? 'Razorpay test mode' : 'COD available'}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(hero.length ? hero : products.slice(0, 3)).map((p, i) => (
                <Link
                  key={p.id}
                  to={`/product/${p.slug}`}
                  className={`group overflow-hidden rounded-2xl bg-white/10 p-2 backdrop-blur transition hover:bg-white/20 ${i === 1 ? 'mt-6' : ''}`}
                >
                  <SmartImage src={p.images?.[0]} alt={p.name} wrapperClass="aspect-square rounded-xl bg-white" className="transition group-hover:scale-105" />
                  <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-tight text-white/90">{p.name}</p>
                  <p className="text-xs font-bold">{inr(p.price)}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-start gap-3 rounded-2xl border border-ink-200/70 bg-white p-3.5 dark:border-ink-800 dark:bg-ink-900">
              <span className="text-lg" aria-hidden="true">{t.icon}</span>
              <div>
                <p className="text-xs font-bold text-ink-900 dark:text-white">{t.title}</p>
                <p className="text-[11px] text-ink-500 dark:text-ink-400">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <Section title="Shop by category" subtitle="Ten departments, hundreds of subcategories" href="/categories" linkLabel="All categories">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <Link key={c.slug} to={`/category/${c.slug}`} className="group overflow-hidden rounded-2xl border border-ink-200/70 bg-white transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-float dark:border-ink-800 dark:bg-ink-900">
              <SmartImage
                src={imageUrl(`/api/img/category/${c.slug}.svg?glyph=${c.glyph}&hue=${c.hue}&label=${encodeURIComponent(c.name)}&w=400&h=280`)}
                alt={c.name}
                wrapperClass="aspect-[4/3] w-full"
                className="transition duration-500 group-hover:scale-105"
              />
              <div className="p-3">
                <p className="text-sm font-bold text-ink-900 group-hover:text-brand-700 dark:text-white">{c.name}</p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-500 dark:text-ink-400">{c.product_count} products · {(c.subcategories || []).length} subcategories</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Deals */}
      {deals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 dark:border-rose-500/20 dark:from-rose-500/10 dark:via-ink-900 dark:to-amber-500/10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-ink-900 sm:text-2xl dark:text-white">Today’s deals</h2>
                <p className="text-sm text-ink-500 dark:text-ink-400">Limited-time price drops across every department</p>
              </div>
              <div className="flex items-center gap-3">
                <Countdown />
                <Link to="/deals" className="text-sm font-semibold text-brand-700 dark:text-brand-300">View all →</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {deals.slice(0, 5).map((p) => (
                <ProductCard key={p.id} product={p} compact />
              ))}
            </div>
          </div>
        </section>
      )}

      <ProductRow title="Trending now" subtitle="Highest rated products this week" products={trending} href="/shop?sort=rating" />
      <ProductRow title="Bestsellers" subtitle="Most ordered across India" products={bestsellers} href="/shop?bestseller=true" />
      <ProductRow title="New arrivals" subtitle="Fresh stock added recently" products={newArrivals} href="/shop?sort=newest" />

      {/* Collections */}
      {collections.map(({ category, items }) =>
        items.length ? (
          <ProductRow
            key={category.slug}
            title={`${category.name} collection`}
            subtitle={category.tagline}
            products={items}
            href={`/category/${category.slug}`}
            linkLabel={`Shop ${category.name}`}
          />
        ) : null
      )}

      {recommended.length > 0 && (
        <ProductRow
          title={user ? `Recommended for you, ${user.name?.split(' ')[0]}` : 'Recommended products'}
          subtitle="Based on your browsing and order history"
          products={recommended}
          href="/shop"
        />
      )}

      {/* Recently viewed */}
      {recent.length > 0 && (
        <ProductRow title="Recently viewed" subtitle="Pick up where you left off" products={recent} href="/shop" />
      )}

      {/* Testimonials */}
      <Section title="What shoppers say" subtitle="Sample reviews shown while the store is in demo mode" href="/blog" linkLabel="Read buying guides">
        <div className="grid gap-3 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-2xl border border-ink-200/70 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
              <Stars value={t.rating} />
              <blockquote className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">“{t.text}”</blockquote>
              <figcaption className="mt-3 text-xs font-bold text-ink-900 dark:text-white">{t.name} <span className="font-normal text-ink-400">· {t.city}</span></figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* Blog previews */}
      {posts.length > 0 && (
        <Section title="From the blog" subtitle="Buying guides, reviews and shopping tips" href="/blog" linkLabel="All articles">
          <div className="grid gap-4 sm:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="group overflow-hidden rounded-2xl border border-ink-200/70 bg-white transition hover:-translate-y-1 hover:shadow-float dark:border-ink-800 dark:bg-ink-900">
                <SmartImage src={post.cover_image} alt={post.title} wrapperClass="aspect-[16/9] w-full" className="transition group-hover:scale-105" />
                <div className="p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">{post.category}</p>
                  <h3 className="mt-1 line-clamp-2 font-display text-base font-bold text-ink-900 group-hover:text-brand-700 dark:text-white">{post.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-500 dark:text-ink-400">{post.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {!products.length && (
        <div className="mx-auto max-w-3xl px-4">
          <EmptyState title="The catalogue is empty" text="Run the seeder (npm run seed) to load demo products, or add products from the admin dashboard." action={<Link to="/admin/login"><Button>Admin login</Button></Link>} />
        </div>
      )}
    </div>
  );
}
