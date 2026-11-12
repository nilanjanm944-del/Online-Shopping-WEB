/**
 * Catalogue page used for Shop, Category, Search and Deals.
 * Filters and sorting are encoded in the URL so results are shareable.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, qs } from '../lib/api';
import { Badge, Breadcrumbs, Button, EmptyState, Field, Input, PageLoader, Pagination, Select, cx } from '../components/ui';
import ProductCard from '../components/ProductCard';
import { inr } from '../lib/format';

const PRICE_BANDS = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { label: '₹1,000 – ₹2,500', min: 1000, max: 2500 },
  { label: '₹2,500 – ₹5,000', min: 2500, max: 5000 },
  { label: '₹5,000 – ₹10,000', min: 5000, max: 10000 },
  { label: 'Over ₹10,000', min: 10000, max: '' },
];

const RATINGS = [4, 3, 2];
const DISCOUNTS = [10, 25, 40, 50];

function toggleValue(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterGroup({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-ink-100 py-3 last:border-0 dark:border-ink-800">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left" aria-expanded={open}>
        <span className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-200">{title}</span>
        <span className="text-ink-400">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mt-2.5 space-y-1.5">{children}</div>}
    </div>
  );
}

function Check({ checked, onChange, label, count }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-[11px] text-ink-400">{count}</span>}
    </label>
  );
}

export default function Shop({ mode = 'shop' }) {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [category, setCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useMemo(() => Object.fromEntries(params.entries()), [params]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const search = { ...query, limit: query.limit || 24 };
    if (mode === 'category' && slug) search.category = slug;
    if (mode === 'deals') search.deals = 'true';
    if (mode === 'search' && !search.q) {
      setData({ products: [], total: 0, pages: 1, page: 1, facets: {} });
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    api
      .get(`/products?${qs(search)}`)
      .then((res) => alive && setData(res))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [params, mode, slug]);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.categories || [])).catch(() => null);
  }, []);

  useEffect(() => {
    if (mode !== 'category' || !slug) {
      setCategory(null);
      return;
    }
    const fromList = categories.find((c) => c.slug === slug);
    if (fromList) setCategory(fromList);
    else api.get(`/categories/${slug}`).then((res) => setCategory(res.category)).catch(() => null);
  }, [mode, slug, categories]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value === '' || value === null || value === undefined) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const setMany = (entries) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(entries)) {
      if (value === '' || value === null || value === undefined) next.delete(key);
      else next.set(key, String(value));
    }
    next.delete('page');
    setParams(next, { replace: true });
  };

  const multi = (key) => String(query[key] || '').split(',').filter(Boolean);
  const toggleMulti = (key, value) => {
    const next = toggleValue(multi(key), value);
    setParam(key, next.join(','));
  };

  const reset = () => {
    const keep = new URLSearchParams();
    if (query.q) keep.set('q', query.q);
    setParams(keep, { replace: true });
  };

  const facets = data?.facets || {};
  const activeCount =
    ['brand', 'size', 'color', 'min', 'max', 'rating', 'discount', 'in_stock', 'subcategory', 'group', 'bestseller', 'featured'].filter((k) => query[k]).length +
    Object.keys(query).filter((k) => k.startsWith('spec.')).length;

  const heading =
    mode === 'search'
      ? `Search results for “${query.q || ''}”`
      : mode === 'deals'
        ? 'Today’s deals'
        : mode === 'category'
          ? category?.name || 'Category'
          : 'All products';

  const crumbs = [{ label: 'Home', to: '/' }, { label: 'Shop', to: '/shop' }];
  if (mode === 'category' && category) crumbs.push({ label: category.name });
  if (mode === 'search') crumbs.push({ label: 'Search' });
  if (mode === 'deals') crumbs.push({ label: 'Deals' });

  const sortOptions = data?.sort_options || {
    popularity: 'Popularity',
    price_asc: 'Price: Low to High',
    price_desc: 'Price: High to Low',
    rating: 'Customer rating',
    newest: 'Newest arrivals',
    discount: 'Highest discount',
  };

  const FilterPanel = (
    <div className="space-y-1">
      <div className="flex items-center justify-between pb-2">
        <p className="text-sm font-bold text-ink-900 dark:text-white">Filters</p>
        <button type="button" onClick={reset} className="text-xs font-semibold text-brand-700 dark:text-brand-300">Reset all</button>
      </div>

      {mode === 'category' && category?.subcategories?.length > 0 && (
        <FilterGroup title="Subcategory">
          {category.subcategories.map((s) => (
            <Check
              key={s.slug}
              checked={query.subcategory === s.slug}
              onChange={() => setParam('subcategory', query.subcategory === s.slug ? '' : s.slug)}
              label={s.name}
            />
          ))}
        </FilterGroup>
      )}

      {facets.price && (
        <FilterGroup title="Price">
          {PRICE_BANDS.map((band) => (
            <Check
              key={band.label}
              checked={String(query.min) === String(band.min) && String(query.max) === String(band.max)}
              onChange={() =>
                String(query.min) === String(band.min) && String(query.max) === String(band.max)
                  ? setMany({ min: '', max: '' })
                  : setMany({ min: band.min, max: band.max })
              }
              label={band.label}
            />
          ))}
          <div className="mt-2 flex items-center gap-2">
            <Input type="number" min="0" placeholder={String(facets.price.min ?? 0)} value={query.min || ''} onChange={(e) => setParam('min', e.target.value)} className="py-1.5 text-xs" aria-label="Minimum price" />
            <span className="text-xs text-ink-400">to</span>
            <Input type="number" min="0" placeholder={String(facets.price.max ?? '')} value={query.max || ''} onChange={(e) => setParam('max', e.target.value)} className="py-1.5 text-xs" aria-label="Maximum price" />
          </div>
          {facets.price.max > 0 && <p className="mt-1 text-[11px] text-ink-400">Available range: {inr(facets.price.min)} – {inr(facets.price.max)}</p>}
        </FilterGroup>
      )}

      {facets.brands?.length > 0 && (
        <FilterGroup title="Brand">
          {facets.brands.slice(0, 10).map((b) => (
            <Check key={b.value} checked={multi('brand').includes(b.value)} onChange={() => toggleMulti('brand', b.value)} label={b.value} count={b.count} />
          ))}
        </FilterGroup>
      )}

      {facets.sizes?.length > 0 && (
        <FilterGroup title="Size">
          <div className="flex flex-wrap gap-1.5">
            {facets.sizes.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleMulti('size', s.value)}
                className={cx(
                  'rounded-lg border px-2.5 py-1 text-xs font-semibold transition',
                  multi('size').includes(s.value)
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-ink-200 text-ink-600 hover:border-brand-400 dark:border-ink-700 dark:text-ink-300'
                )}
              >
                {s.value}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}

      {facets.colors?.length > 0 && (
        <FilterGroup title="Colour">
          <div className="flex flex-wrap gap-1.5">
            {facets.colors.slice(0, 12).map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleMulti('color', c.value)}
                className={cx(
                  'rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition',
                  multi('color').includes(c.value)
                    ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
                    : 'border-ink-200 text-ink-600 hover:border-brand-400 dark:border-ink-700 dark:text-ink-300'
                )}
              >
                {c.value}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Customer rating">
        {RATINGS.map((r) => (
          <Check key={r} checked={String(query.rating) === String(r)} onChange={() => setParam('rating', String(query.rating) === String(r) ? '' : r)} label={`${r}★ & above`} />
        ))}
      </FilterGroup>

      <FilterGroup title="Discount">
        {DISCOUNTS.map((d) => (
          <Check key={d} checked={String(query.discount) === String(d)} onChange={() => setParam('discount', String(query.discount) === String(d) ? '' : d)} label={`${d}% and more`} />
        ))}
      </FilterGroup>

      <FilterGroup title="Availability">
        <Check checked={query.in_stock === 'true'} onChange={() => setParam('in_stock', query.in_stock === 'true' ? '' : 'true')} label="In stock only" />
        <Check checked={query.bestseller === 'true'} onChange={() => setParam('bestseller', query.bestseller === 'true' ? '' : 'true')} label="Bestsellers" />
        <Check checked={query.featured === 'true'} onChange={() => setParam('featured', query.featured === 'true' ? '' : 'true')} label="Featured" />
      </FilterGroup>

      {facets.specs?.map((group) => (
        <FilterGroup key={group.field} title={group.field} defaultOpen={false}>
          {group.values.map((v) => (
            <Check
              key={v.value}
              checked={multi(`spec.${group.field}`).includes(v.value)}
              onChange={() => toggleMulti(`spec.${group.field}`, v.value)}
              label={v.value}
              count={v.count}
            />
          ))}
        </FilterGroup>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumbs items={crumbs} />

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900 sm:text-3xl dark:text-white">{heading}</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            {data ? `${data.total} product${data.total === 1 ? '' : 's'}` : 'Loading…'}
            {mode === 'category' && category?.tagline ? ` · ${category.tagline}` : ''}
            {mode === 'deals' ? ' · 35% off and above' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setFiltersOpen(true)} className="rounded-xl border border-ink-200 px-3 py-2 text-xs font-bold text-ink-700 lg:hidden dark:border-ink-700 dark:text-ink-200">
            Filters{activeCount ? ` (${activeCount})` : ''}
          </button>
          <Field label="" className="min-w-[11rem]">
            <Select value={query.sort || ''} onChange={(e) => setParam('sort', e.target.value)} aria-label="Sort products" className="py-2 text-xs">
              <option value="">Recommended</option>
              {Object.entries(sortOptions).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {mode === 'category' && category?.subcategories?.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => setParam('subcategory', '')} className={cx('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold', !query.subcategory ? 'bg-brand-600 text-white' : 'border border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300')}>
            All
          </button>
          {category.subcategories.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setParam('subcategory', s.slug)}
              className={cx('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold', query.subcategory === s.slug ? 'bg-brand-600 text-white' : 'border border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300')}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {Object.entries(query)
            .filter(([k]) => !['q', 'sort', 'page', 'limit', 'category', 'deals'].includes(k) && query[k])
            .map(([k, v]) => (
              <button key={k} type="button" onClick={() => setParam(k, '')} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                {k.startsWith('spec.') ? k.slice(5) : k}: {v} <span aria-hidden="true">✕</span>
              </button>
            ))}
          <button type="button" onClick={reset} className="text-[11px] font-bold text-ink-500 underline dark:text-ink-400">Clear all</button>
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden self-start rounded-2xl border border-ink-200/70 bg-white p-4 lg:block dark:border-ink-800 dark:bg-ink-900">{FilterPanel}</aside>

        <div>
          {loading ? (
            <PageLoader label="Loading products…" />
          ) : error ? (
            <EmptyState icon="⚠️" title="Could not load products" text={error} action={<Button onClick={() => setParams(new URLSearchParams(params), { replace: true })}>Retry</Button>} />
          ) : data?.products?.length ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {data.products.map((p) => (
                  <ProductCard key={p.id} product={p} compact />
                ))}
              </div>
              <div className="mt-6 flex flex-col items-center gap-2">
                <Pagination page={data.page} pages={data.pages} onChange={(page) => setParam('page', page)} />
                <p className="text-xs text-ink-400">Showing {data.products.length} of {data.total} products</p>
              </div>
            </>
          ) : (
            <EmptyState
              icon="🔍"
              title="No products matched"
              text={query.q ? `We could not find anything for “${query.q}”. Try a different keyword or clear the filters.` : 'Try removing some filters to see more products.'}
              action={<Button onClick={reset}>Clear filters</Button>}
            />
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink-950/50" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4 dark:bg-ink-950">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-lg font-bold text-ink-900 dark:text-white">Filters</p>
              <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-lg p-2 text-ink-500" aria-label="Close filters">✕</button>
            </div>
            {FilterPanel}
            <Button className="mt-4 w-full" onClick={() => setFiltersOpen(false)}>Show {data?.total ?? 0} results</Button>
          </div>
        </div>
      )}
    </div>
  );
}
