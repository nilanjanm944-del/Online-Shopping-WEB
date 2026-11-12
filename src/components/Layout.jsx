/** Site chrome: announcement bar, header with search suggestions, mega menu, footer. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../context/StoreProvider';
import { inr } from '../lib/format';
import { Badge, Button, Input, SmartImage, cx } from './ui';

const NAV = [
  { to: '/shop', label: 'Shop All' },
  { to: '/categories', label: 'Categories' },
  { to: '/deals', label: 'Today’s Deals' },
  { to: '/shop?sort=newest', label: 'New Arrivals' },
  { to: '/blog', label: 'Blog' },
  { to: '/vlog', label: 'Vlog' },
  { to: '/track', label: 'Track Order' },
];

function useCategories() {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    let alive = true;
    api
      .get('/categories')
      .then((data) => {
        if (alive) setCategories(data.categories || []);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);
  return categories;
}

function Logo({ brand }) {
  const name = brand?.name || 'ZYREX STORE';
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2" aria-label={`${name} home`}>
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-accent-500 font-display text-lg font-black text-white shadow-card transition group-hover:scale-105">
        Z
      </span>
      <span className="hidden leading-tight sm:block">
        <span className="block font-display text-base font-extrabold tracking-tight text-ink-900 dark:text-white">{name}</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">Premium marketplace</span>
      </span>
    </Link>
  );
}

function SearchBox({ compact = false, onNavigate }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setData(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      api
        .get(`/search/suggest?q=${encodeURIComponent(term)}`)
        .then(setData)
        .catch(() => setData(null));
    }, 220);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    onNavigate?.();
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div ref={boxRef} className={cx('relative w-full', compact ? '' : 'max-w-xl')}>
      <form onSubmit={submit} className="flex w-full items-center overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900">
        <span className="pl-3 text-ink-400" aria-hidden="true">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="5.5" /><path d="M13.5 13.5L17 17" strokeLinecap="round" /></svg>
        </span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search for products, brands and categories"
          aria-label="Search products"
          className="w-full bg-transparent px-2.5 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-400 dark:text-white"
        />
        <button type="submit" className="m-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700">
          Search
        </button>
      </form>

      {open && q.trim().length >= 2 && data && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-float animate-fade-in dark:border-ink-700 dark:bg-ink-900">
          {data.products?.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">Products</p>
              {data.products.slice(0, 5).map((p) => (
                <Link
                  key={p.slug}
                  to={`/product/${p.slug}`}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  <SmartImage src={p.image} alt={p.name} wrapperClass="h-10 w-10 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{p.name}</span>
                    <span className="block text-xs text-ink-500 dark:text-ink-400">{p.brand}</span>
                  </span>
                  <span className="text-sm font-bold text-ink-900 dark:text-white">{inr(p.price)}</span>
                </Link>
              ))}
            </div>
          )}
          {data.categories?.length > 0 && (
            <div className="border-t border-ink-100 p-2 dark:border-ink-800">
              <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">Categories</p>
              <div className="flex flex-wrap gap-1.5 px-2 pb-1">
                {data.categories.map((c) => (
                  <Link key={c.slug} to={`/category/${c.slug}`} onClick={() => setOpen(false)} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {data.subcategories?.length > 0 && (
            <div className="border-t border-ink-100 p-2 dark:border-ink-800">
              <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">Subcategories</p>
              <div className="flex flex-wrap gap-1.5 px-2 pb-1">
                {data.subcategories.map((s) => (
                  <Link key={`${s.category}-${s.sub}`} to={`/category/${s.category}?subcategory=${s.sub}`} onClick={() => setOpen(false)} className="rounded-full border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-600 dark:border-ink-700 dark:text-ink-300">
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <Link
            to={`/search?q=${encodeURIComponent(q.trim())}`}
            onClick={() => setOpen(false)}
            className="block border-t border-ink-100 px-4 py-2.5 text-center text-sm font-bold text-brand-700 hover:bg-brand-50 dark:border-ink-800 dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            See all results for “{q.trim()}”
          </Link>
        </div>
      )}
    </div>
  );
}

function MegaMenu({ categories, onClose }) {
  return (
    <div className="absolute left-0 right-0 top-full z-40 hidden border-t border-ink-100 bg-white shadow-float lg:block dark:border-ink-800 dark:bg-ink-900">
      <div className="mx-auto grid max-w-7xl gap-6 px-8 py-6 sm:grid-cols-2 lg:grid-cols-5">
        {categories.map((c) => (
          <div key={c.slug}>
            <Link to={`/category/${c.slug}`} onClick={onClose} className="mb-2 flex items-center justify-between text-sm font-bold text-ink-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300">
              {c.name}
              <span className="text-[10px] font-semibold text-ink-400">{c.product_count}</span>
            </Link>
            <ul className="space-y-1">
              {(c.subcategories || []).slice(0, 5).map((s) => (
                <li key={s.slug}>
                  <Link to={`/category/${c.slug}?subcategory=${s.slug}`} onClick={onClose} className="text-xs text-ink-500 transition hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to={`/category/${c.slug}`} onClick={onClose} className="mt-2 inline-block text-[11px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">
              View all →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function Header({ brand }) {
  const { cart, wishlist, user, theme, toggleTheme, compare } = useStore();
  const categories = useCategories();
  const [mega, setMega] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMega(false);
    setDrawer(false);
  }, [location.pathname, location.search]);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-ink-800 dark:bg-ink-950/95">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <button type="button" onClick={() => setDrawer(true)} className="rounded-xl p-2 text-ink-600 lg:hidden dark:text-ink-300" aria-label="Open menu">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" /></svg>
        </button>
        <Logo brand={brand} />
        <div className="hidden flex-1 justify-center px-4 md:flex">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={toggleTheme} className="rounded-xl p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/compare" className="relative hidden rounded-xl p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 sm:block dark:text-ink-300 dark:hover:bg-ink-800" aria-label="Compare products">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 15V7M10 15V4M16 15v-4" strokeLinecap="round" /></svg>
            {compare.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-ink-900 px-1 text-[10px] font-bold text-white dark:bg-white dark:text-ink-900">{compare.length}</span>}
          </Link>
          <Link to="/wishlist" className="relative rounded-xl p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800" aria-label="Wishlist">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 16.5S3.5 12.6 3.5 8.1A3.6 3.6 0 0110 5.9a3.6 3.6 0 016.5 2.2c0 4.5-6.5 8.4-6.5 8.4z" strokeLinejoin="round" /></svg>
            {wishlist.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{wishlist.length}</span>}
          </Link>
          <Link to="/cart" className="relative rounded-xl p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800" aria-label="Shopping cart">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 4h1.6l1.7 8.4h8.1L16 6.4H5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="7.5" cy="15.5" r="1.2" /><circle cx="13.5" cy="15.5" r="1.2" /></svg>
            {cart.count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{cart.count}</span>}
          </Link>
          <Link to={user ? '/account' : '/login'} className="ml-1 hidden items-center gap-2 rounded-xl border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-800 transition hover:border-brand-400 hover:text-brand-700 sm:flex dark:border-ink-700 dark:text-ink-100">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-100 text-[10px] font-black text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
              {user ? user.name?.[0]?.toUpperCase() : '👤'}
            </span>
            {user ? user.name?.split(' ')[0] : 'Login'}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-2 md:hidden">
        <SearchBox compact />
      </div>

      <div className="hidden border-t border-ink-100 lg:block dark:border-ink-800" onMouseLeave={() => setMega(false)}>
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-8">
          <button
            type="button"
            onMouseEnter={() => setMega(true)}
            onClick={() => setMega((m) => !m)}
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-ink-900 transition hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
            aria-expanded={mega}
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 5h14M3 10h14M3 15h9" strokeLinecap="round" /></svg>
            All Categories
          </button>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx('rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:text-brand-700 dark:hover:text-brand-300', isActive ? 'text-brand-700 dark:text-brand-300' : 'text-ink-600 dark:text-ink-300')
              }
            >
              {item.label}
            </NavLink>
          ))}
          <span className="ml-auto hidden items-center gap-1.5 text-xs font-semibold text-emerald-600 xl:flex dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Free delivery over ₹999
          </span>
        </div>
        {mega && <MegaMenu categories={categories} onClose={() => setMega(false)} />}
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink-950/50" aria-label="Close menu" onClick={() => setDrawer(false)} />
          <div className="relative flex h-full w-[86%] max-w-sm flex-col overflow-y-auto bg-white p-4 shadow-float animate-fade-in dark:bg-ink-950">
            <div className="mb-4 flex items-center justify-between">
              <Logo brand={brand} />
              <button type="button" onClick={() => setDrawer(false)} className="rounded-xl p-2 text-ink-500" aria-label="Close menu">✕</button>
            </div>
            <Link to={user ? '/account' : '/login'} onClick={() => setDrawer(false)} className="mb-4 flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
              {user ? `Hi, ${user.name?.split(' ')[0]}` : 'Login / Create account'} <span>→</span>
            </Link>
            <nav className="space-y-1">
              {NAV.map((item) => (
                <Link key={item.to} to={item.to} onClick={() => setDrawer(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-50 dark:text-ink-100 dark:hover:bg-ink-900">
                  {item.label}
                </Link>
              ))}
              <Link to="/wishlist" onClick={() => setDrawer(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-50 dark:text-ink-100 dark:hover:bg-ink-900">Wishlist ({wishlist.length})</Link>
              <Link to="/account/orders" onClick={() => setDrawer(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-50 dark:text-ink-100 dark:hover:bg-ink-900">My Orders</Link>
            </nav>
            <p className="mt-5 mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">Shop by category</p>
            <div className="space-y-1">
              {categories.map((c) => (
                <div key={c.slug}>
                  <Link to={`/category/${c.slug}`} onClick={() => setDrawer(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-900">
                    {c.name} <span className="text-xs text-ink-400">{c.product_count}</span>
                  </Link>
                  <div className="mb-1 flex flex-wrap gap-1.5 px-3">
                    {(c.subcategories || []).slice(0, 3).map((s) => (
                      <Link key={s.slug} to={`/category/${c.slug}?subcategory=${s.slug}`} onClick={() => setDrawer(false)} className="rounded-full border border-ink-200 px-2 py-0.5 text-[11px] text-ink-500 dark:border-ink-700 dark:text-ink-400">
                        {s.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Footer({ brand }) {
  const { lang, setLang, notify, user, isAdmin } = useStore();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const subscribe = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/newsletter', { email });
      notify(res.message || 'Subscribed');
      setEmail('');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const linkCls = 'text-sm text-ink-500 transition hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300';

  return (
    <footer className="mt-16 border-t border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo brand={brand} />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              {brand?.tagline || 'Everything you need, in one premium marketplace.'} Shop fashion, electronics, home, grocery, beauty, books, toys and more with secure payments and easy returns.
            </p>
            <div className="mt-4 space-y-1 text-sm text-ink-500 dark:text-ink-400">
              <p>{brand?.support_email}</p>
              <p>{brand?.support_phone} · {brand?.support_hours}</p>
              <p className="text-xs leading-relaxed">{brand?.address}</p>
            </div>
            <div className="mt-4 flex gap-2">
              {Object.entries(brand?.social || {}).map(([key, url]) => (
                <a key={key} href={url} target="_blank" rel="noreferrer noopener" className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 text-[11px] font-bold uppercase text-ink-600 transition hover:border-brand-400 hover:text-brand-700 dark:border-ink-700 dark:text-ink-300">
                  {key[0]}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-900 dark:text-white">Shop</h3>
            <ul className="space-y-2">
              {[
                ['/shop', 'All Products'],
                ['/categories', 'All Categories'],
                ['/deals', 'Today’s Deals'],
                ['/shop?sort=newest', 'New Arrivals'],
                ['/shop?bestseller=true', 'Bestsellers'],
                ['/compare', 'Compare Products'],
              ].map(([to, label]) => (
                <li key={to}><Link to={to} className={linkCls}>{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-900 dark:text-white">Help</h3>
            <ul className="space-y-2">
              {[
                ['/help', 'Help Centre'],
                ['/faq', 'FAQs'],
                ['/contact', 'Contact Us'],
                ['/track', 'Track Your Order'],
                ['/shipping-policy', 'Shipping Policy'],
                ['/return-policy', 'Returns & Refunds'],
                ['/about', 'About Us'],
                ['/blog', 'Blog'],
                ['/vlog', 'Vlog'],
              ].map(([to, label]) => (
                <li key={to}><Link to={to} className={linkCls}>{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-900 dark:text-white">Stay in the loop</h3>
            <p className="mb-3 text-sm text-ink-500 dark:text-ink-400">Early access to sales, new arrivals and shopping guides. No spam.</p>
            <form onSubmit={subscribe} className="flex gap-2">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" className="py-2" />
              <Button type="submit" disabled={busy} className="shrink-0">{busy ? '…' : 'Join'}</Button>
            </form>
            <div className="mt-4">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-400" htmlFor="lang">Language</label>
              <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs font-semibold text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
                <option value="en">English</option>
                <option value="bn">বাংলা (Bengali) — beta</option>
              </select>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-400">
              {['UPI', 'Visa', 'Mastercard', 'RuPay', 'Net Banking', 'COD'].map((m) => (
                <span key={m} className="rounded border border-ink-200 px-1.5 py-0.5 dark:border-ink-700">{m}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-ink-100 pt-6 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between dark:border-ink-800">
          <p>© {new Date().getFullYear()} {brand?.name || 'ZYREX STORE'}. Demo storefront — sample products and prices. GSTIN: {brand?.gstin || 'pending'}.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/privacy-policy" className="hover:text-brand-700 dark:hover:text-brand-300">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-700 dark:hover:text-brand-300">Terms</Link>
            <Link to="/return-policy" className="hover:text-brand-700 dark:hover:text-brand-300">Refunds</Link>
            {isAdmin && <Link to="/admin" className="font-bold text-brand-700 dark:text-brand-300">Admin</Link>}
            {!user && <Link to="/admin/login" className="hover:text-brand-700 dark:hover:text-brand-300">Admin login</Link>}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Layout({ children }) {
  const { settings, brand } = useStore();
  return (
    <div className="flex min-h-screen flex-col bg-ink-50/60 dark:bg-ink-950">
      {brand?.announcement && (
        <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-accent-600 px-4 py-1.5 text-center text-[11px] font-semibold text-white sm:text-xs">
          {brand.announcement}{' '}
          <Link to="/deals" className="underline underline-offset-2">Shop the sale →</Link>
        </div>
      )}
      <Header brand={brand} />
      <main className="flex-1">{children}</main>
      <Footer brand={brand || settings?.brand || {}} />
    </div>
  );
}

export { NAV, useCategories };
