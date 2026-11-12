/**
 * Catalogue routes: categories, products, search, facets, reviews,
 * recently-viewed and rule-based recommendations.
 */
import express from 'express';
import { filter, find, insert, table, update } from '../store.js';
import { optionalAuth, requireAuth } from '../auth.js';

const router = express.Router();

const toArray = (v) => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : String(v).split(','))
  .map((s) => String(s).trim())
  .filter(Boolean);

const num = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const SORT_LABEL = {
  relevance: 'Relevance',
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
  rating: 'Customer Rating',
  newest: 'Newest Arrivals',
  discount: 'Highest Discount',
  popularity: 'Popularity',
};

function publicProduct(p) {
  return p;
}

/** Filter + sort + paginate a product list using query-string parameters. */
export function queryProducts(source, query = {}) {
  let rows = source.slice();
  const term = String(query.q || '').trim().toLowerCase();
  const brands = toArray(query.brand).map((b) => b.toLowerCase());
  const sizes = toArray(query.size);
  const colors = toArray(query.color).map((c) => c.toLowerCase());
  const category = String(query.category || '').trim();
  const subcategory = String(query.subcategory || '').trim();
  const group = String(query.group || '').trim();
  const min = num(query.min);
  const max = num(query.max);
  const rating = num(query.rating);
  const discount = num(query.discount);
  const inStock = String(query.in_stock || '') === 'true';
  const featured = String(query.featured || '') === 'true';
  const bestseller = String(query.bestseller || '') === 'true';
  const newArrival = String(query.new_arrival || '') === 'true';
  const deals = String(query.deals || '') === 'true';

  if (term) {
    const words = term.split(/\s+/).filter(Boolean);
    rows = rows.filter((p) => {
      const haystack = [
        p.name,
        p.brand,
        p.category_name,
        p.subcategory_name,
        p.group_name,
        p.description,
        ...(p.tags || []),
        ...Object.values(p.specs || {}),
      ]
        .join(' ')
        .toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }
  if (category) rows = rows.filter((p) => p.category_slug === category);
  if (subcategory) rows = rows.filter((p) => p.subcategory_slug === subcategory);
  if (group) rows = rows.filter((p) => p.group_name === group);
  if (brands.length) rows = rows.filter((p) => brands.includes(String(p.brand).toLowerCase()));
  if (sizes.length) rows = rows.filter((p) => (p.sizes || []).some((s) => sizes.includes(s)));
  if (colors.length) rows = rows.filter((p) => (p.colors || []).some((c) => colors.includes(String(c).toLowerCase())));
  if (min !== null) rows = rows.filter((p) => p.price >= min);
  if (max !== null) rows = rows.filter((p) => p.price <= max);
  if (rating !== null) rows = rows.filter((p) => p.rating >= rating);
  if (discount !== null) rows = rows.filter((p) => p.discount_percent >= discount);
  if (inStock) rows = rows.filter((p) => p.in_stock);
  if (featured) rows = rows.filter((p) => p.featured);
  if (bestseller) rows = rows.filter((p) => p.bestseller);
  if (newArrival) rows = rows.filter((p) => p.new_arrival);
  if (deals) rows = rows.filter((p) => p.discount_percent >= 35);

  // Specification filters arrive as spec.<Field>=value
  const specFilters = Object.entries(query)
    .filter(([k]) => k.startsWith('spec.'))
    .map(([k, v]) => [k.slice(5), toArray(v).map((x) => x.toLowerCase())]);
  if (specFilters.length) {
    rows = rows.filter((p) =>
      specFilters.every(([field, values]) => {
        const actual = String(p.specs?.[field] ?? '').toLowerCase();
        return values.some((v) => actual === v);
      })
    );
  }

  const sort = String(query.sort || (term ? 'relevance' : 'popularity'));
  const sorters = {
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating || b.review_count - a.review_count,
    newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    discount: (a, b) => b.discount_percent - a.discount_percent,
    popularity: (a, b) => (b.sold_count || 0) - (a.sold_count || 0) || b.rating - a.rating,
    relevance: (a, b) => (b.sold_count || 0) - (a.sold_count || 0),
  };
  rows.sort(sorters[sort] || sorters.popularity);

  const page = Math.max(1, num(query.page, 1));
  const limit = Math.min(60, Math.max(1, num(query.limit, 24)));
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const paged = rows.slice((page - 1) * limit, page * limit);

  return { products: paged.map(publicProduct), total, page, pages, limit, sort, sort_options: SORT_LABEL };
}

/** Facet counts for the current result set (before pagination). */
export function buildFacets(products) {
  const count = (arr) => {
    const map = new Map();
    for (const v of arr) map.set(v, (map.get(v) || 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, count: n }));
  };
  const brands = count(products.map((p) => p.brand));
  const sizes = count(products.flatMap((p) => p.sizes || []));
  const colors = count(products.flatMap((p) => p.colors || []));
  const subs = count(products.map((p) => p.subcategory_name));
  const prices = products.map((p) => p.price);
  return {
    brands,
    sizes,
    colors,
    subcategories: subs,
    price: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    },
    specs: Object.entries(
      products.reduce((acc, p) => {
        for (const [k, v] of Object.entries(p.specs || {})) {
          acc[k] = acc[k] || new Map();
          acc[k].set(v, (acc[k].get(v) || 0) + 1);
        }
        return acc;
      }, {})
    )
      .filter(([, m]) => m.size > 1 && m.size <= 8)
      .slice(0, 6)
      .map(([field, m]) => ({ field, values: [...m.entries()].map(([value, n]) => ({ value, count: n })) })),
  };
}

router.get('/categories', (_req, res) => {
  const products = table('products');
  const cats = table('categories')
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((c) => {
      const items = products.filter((p) => p.category_slug === c.slug);
      return {
        ...c,
        product_count: items.length,
        subcategories: table('subcategories')
          .filter((s) => s.category_slug === c.slug)
          .sort((a, b) => a.position - b.position),
      };
    });
  res.json({ categories: cats });
});

router.get('/categories/:slug', (req, res) => {
  const category = find('categories', (c) => c.slug === req.params.slug);
  if (!category) return res.status(404).json({ error: 'Category not found.' });
  const items = filter('products', (p) => p.category_slug === category.slug);
  const subs = table('subcategories')
    .filter((s) => s.category_slug === category.slug)
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ ...s, product_count: items.filter((p) => p.subcategory_slug === s.slug).length }));
  const groups = [...new Set(subs.map((s) => s.group_name))].map((name) => ({
    name,
    subcategories: subs.filter((s) => s.group_name === name),
  }));
  res.json({ category, subcategories: subs, groups, facets: buildFacets(items), total: items.length });
});

router.get('/products', (req, res) => {
  const all = table('products');
  const result = queryProducts(all, req.query);
  res.json({ ...result, facets: buildFacets(all.filter((p) => {
    const q = { ...req.query };
    delete q.page;
    delete q.limit;
    delete q.sort;
    return queryProducts([p], { ...q, page: 1, limit: 1 }).total === 1;
  })) });
});

router.get('/products/:slug', (req, res) => {
  const product = find('products', (p) => p.slug === req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const reviews = filter('reviews', (r) => r.product_id === product.id).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  const related = table('products')
    .filter((p) => p.id !== product.id && p.subcategory_slug === product.subcategory_slug)
    .slice(0, 8);
  const alsoViewed = table('products')
    .filter((p) => p.id !== product.id && p.category_slug === product.category_slug)
    .sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0))
    .slice(0, 8);
  const together = table('products')
    .filter((p) => p.id !== product.id && (p.group_name === product.group_name || p.brand === product.brand))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);
  res.json({
    product,
    reviews,
    related,
    also_viewed: alsoViewed,
    frequently_bought: together,
  });
});

router.get('/products/:slug/reviews', (req, res) => {
  const product = find('products', (p) => p.slug === req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const reviews = filter('reviews', (r) => r.product_id === product.id).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  res.json({ reviews, breakdown: product.rating_breakdown, rating: product.rating, count: product.review_count });
});

router.post('/products/:slug/reviews', requireAuth, (req, res) => {
  const product = find('products', (p) => p.slug === req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const rating = Number(req.body?.rating);
  const body = String(req.body?.body || '').trim();
  const title = String(req.body?.title || '').trim().slice(0, 120);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Please choose a rating between 1 and 5.' });
  }
  if (body.length < 10) return res.status(400).json({ error: 'Please write at least 10 characters.' });
  if (find('reviews', (r) => r.product_id === product.id && r.user_id === req.auth.id)) {
    return res.status(409).json({ error: 'You have already reviewed this product.' });
  }
  const purchased = filter('orders', (o) => o.user_id === req.auth.id).some((o) =>
    (o.items || []).some((i) => i.product_id === product.id)
  );
  const review = insert('reviews', {
    product_id: product.id,
    product_slug: product.slug,
    user_id: req.auth.id,
    author: req.auth.name,
    rating,
    title: title || 'Customer review',
    body,
    verified: purchased,
  });
  // Recompute the displayed rating as a weighted average of seeded and live reviews.
  const live = filter('reviews', (r) => r.product_id === product.id && r.user_id);
  const baseCount = Math.max(0, product.review_count - (live.length - 1));
  const baseTotal = product.rating * baseCount;
  const liveTotal = live.reduce((s, r) => s + r.rating, 0);
  const totalCount = baseCount + live.length;
  const breakdown = { ...(product.rating_breakdown || {}) };
  breakdown[rating] = (breakdown[rating] || 0) + 1;
  update('products', product.id, {
    rating: Number(((baseTotal + liveTotal) / totalCount).toFixed(1)),
    review_count: totalCount,
    rating_breakdown: breakdown,
  });
  res.status(201).json({ review });
});

router.get('/search/suggest', (req, res) => {
  const term = String(req.query.q || '').trim().toLowerCase();
  if (term.length < 2) return res.json({ products: [], categories: [], suggestions: [] });
  const words = term.split(/\s+/).filter(Boolean);
  const matches = table('products')
    .filter((p) => {
      const hay = `${p.name} ${p.brand} ${p.category_name} ${p.subcategory_name} ${(p.tags || []).join(' ')}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0))
    .slice(0, 6)
    .map((p) => ({ slug: p.slug, name: p.name, image: p.images[0], price: p.price, mrp: p.mrp, brand: p.brand }));
  const cats = table('categories')
    .filter((c) => c.name.toLowerCase().includes(term))
    .slice(0, 4)
    .map((c) => ({ slug: c.slug, name: c.name }));
  const subs = table('subcategories')
    .filter((s) => s.name.toLowerCase().includes(term))
    .slice(0, 5)
    .map((s) => ({ name: s.name, category: s.category_slug, sub: s.slug }));
  const suggestions = [...new Set([...subs.map((s) => s.name), ...cats.map((c) => c.name)])].slice(0, 6);
  res.json({ products: matches, categories: cats, subcategories: subs, suggestions });
});

/* ------------------------- Recently viewed ------------------------------ */

router.get('/recently-viewed', optionalAuth, (req, res) => {
  if (!req.user) return res.json({ products: [] });
  const rows = filter('recently_viewed', (r) => r.user_id === req.user.id)
    .sort((a, b) => new Date(b.viewed_at) - new Date(a.viewed_at))
    .slice(0, 12);
  const products = rows
    .map((r) => find('products', (p) => p.id === r.product_id))
    .filter(Boolean);
  res.json({ products });
});

router.post('/recently-viewed', optionalAuth, (req, res) => {
  if (!req.user) return res.json({ ok: true });
  const product = find('products', (p) => p.slug === req.body?.slug || p.id === req.body?.product_id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const existing = find('recently_viewed', (r) => r.user_id === req.user.id && r.product_id === product.id);
  if (existing) {
    existing.viewed_at = new Date().toISOString();
  } else {
    insert('recently_viewed', { user_id: req.user.id, product_id: product.id, viewed_at: new Date().toISOString() });
  }
  res.json({ ok: true });
});

/* ------------------------ Recommendations ------------------------------- */

router.get('/recommendations', optionalAuth, (req, res) => {
  const all = table('products');
  if (!req.user) {
    return res.json({
      basis: 'bestsellers',
      products: all.filter((p) => p.bestseller).sort((a, b) => b.rating - a.rating).slice(0, 8),
    });
  }
  const viewed = filter('recently_viewed', (r) => r.user_id === req.user.id);
  const viewedIds = new Set(viewed.map((r) => r.product_id));
  const viewedProducts = all.filter((p) => viewedIds.has(p.id));
  const categories = new Set(viewedProducts.map((p) => p.category_slug));
  const orders = filter('orders', (o) => o.user_id === req.user.id);
  for (const o of orders) {
    for (const item of o.items || []) {
      const p = all.find((x) => x.id === item.product_id);
      if (p) categories.add(p.category_slug);
    }
  }
  const pool = categories.size ? all.filter((p) => categories.has(p.category_slug)) : all;
  const products = pool
    .filter((p) => !viewedIds.has(p.id))
    .sort((a, b) => b.rating - a.rating || (b.sold_count || 0) - (a.sold_count || 0))
    .slice(0, 8);
  res.json({ basis: categories.size ? 'browsing-history' : 'bestsellers', products });
});

/** Compare up to four products by slug. */
router.get('/compare', (req, res) => {
  const slugs = toArray(req.query.slugs).slice(0, 4);
  const products = slugs.map((s) => find('products', (p) => p.slug === s)).filter(Boolean);
  const fields = [...new Set(products.flatMap((p) => Object.keys(p.specs || {})))];
  res.json({ products, fields });
});

export default router;
