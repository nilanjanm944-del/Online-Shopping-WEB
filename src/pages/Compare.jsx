/** Side-by-side product comparison for up to four products. */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../context/StoreProvider';
import { inr } from '../lib/format';
import { Badge, Breadcrumbs, Button, EmptyState, SmartImage, Stars } from '../components/ui';

const specEntries = (specs) => {
  if (!specs) return [];
  if (Array.isArray(specs)) return specs.map((s) => [s.label || s.key || '', s.value ?? '']);
  return Object.entries(specs);
};

export default function Compare() {
  const { compare, toggleCompare, clearCompare, addToCart, notify } = useStore();
  const [fresh, setFresh] = useState([]);

  const slugs = useMemo(() => compare.map((p) => p.slug).filter(Boolean), [compare]);

  useEffect(() => {
    if (!slugs.length) {
      setFresh([]);
      return undefined;
    }
    let alive = true;
    api
      .get(`/compare?slugs=${encodeURIComponent(slugs.join(','))}`)
      .then((data) => {
        if (!alive) return;
        const rows = Array.isArray(data) ? data : data.products || data.items || [];
        setFresh(rows.length ? rows : compare);
      })
      .catch(() => alive && setFresh(compare));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs.join(',')]);

  const rows = fresh.length ? fresh : compare;

  const specRows = useMemo(() => {
    const keys = new Set();
    for (const p of rows) for (const [k] of specEntries(p.specs)) keys.add(k);
    return [...keys];
  }, [rows]);

  if (!rows.length) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon="⚖️"
          title="No products to compare"
          text="Add up to four products using the Compare button on any product card."
          action={<Button as={Link} to="/shop">Browse products</Button>}
        />
      </div>
    );
  }

  const cell = 'border-b border-ink-200 px-3 py-2.5 text-sm dark:border-ink-800';

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Compare' }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Compare products</h1>
        <Button variant="ghost" size="sm" onClick={clearCompare}>Clear all</Button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className={`${cell} w-36 text-left text-xs uppercase tracking-wide text-ink-500`}>Product</th>
              {rows.map((p) => (
                <th key={p.id} className={`${cell} align-top`}>
                  <div className="flex flex-col gap-2">
                    <Link to={`/product/${p.slug}`}>
                      <SmartImage src={p.images?.[0]} alt={p.name} wrapperClass="aspect-square rounded-xl" className="h-full w-full object-cover" />
                    </Link>
                    <Link to={`/product/${p.slug}`} className="line-clamp-2 text-left text-sm font-semibold hover:text-brand-600">
                      {p.name}
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleCompare(p)}
                      className="text-left text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className={`${cell} text-left font-semibold`}>Price</th>
              {rows.map((p) => (
                <td key={p.id} className={`${cell} font-semibold`}>{inr(p.price)}</td>
              ))}
            </tr>
            <tr>
              <th className={`${cell} text-left font-semibold`}>MRP</th>
              {rows.map((p) => (
                <td key={p.id} className={`${cell} text-ink-500 line-through`}>{inr(p.mrp)}</td>
              ))}
            </tr>
            <tr>
              <th className={`${cell} text-left font-semibold`}>Brand</th>
              {rows.map((p) => (
                <td key={p.id} className={cell}>{p.brand}</td>
              ))}
            </tr>
            <tr>
              <th className={`${cell} text-left font-semibold`}>Rating</th>
              {rows.map((p) => (
                <td key={p.id} className={cell}>
                  <Stars value={p.rating} count={p.review_count} />
                </td>
              ))}
            </tr>
            <tr>
              <th className={`${cell} text-left font-semibold`}>Availability</th>
              {rows.map((p) => (
                <td key={p.id} className={cell}>
                  {Number(p.stock) > 0 ? <Badge tone="success">In stock</Badge> : <Badge tone="danger">Out of stock</Badge>}
                </td>
              ))}
            </tr>
            <tr>
              <th className={`${cell} text-left font-semibold`}>Sizes</th>
              {rows.map((p) => (
                <td key={p.id} className={cell}>{(p.sizes || []).join(', ') || '—'}</td>
              ))}
            </tr>
            <tr>
              <th className={`${cell} text-left font-semibold`}>Colours</th>
              {rows.map((p) => (
                <td key={p.id} className={cell}>{(p.colors || []).join(', ') || '—'}</td>
              ))}
            </tr>
            {specRows.map((key) => (
              <tr key={key}>
                <th className={`${cell} text-left font-semibold`}>{key}</th>
                {rows.map((p) => {
                  const found = specEntries(p.specs).find(([k]) => k === key);
                  return (
                    <td key={p.id} className={cell}>{found ? String(found[1]) : '—'}</td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th className={cell} />
              {rows.map((p) => (
                <td key={p.id} className={cell}>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (p.sizes?.length || p.colors?.length) {
                        notify('Choose size and colour on the product page', 'info');
                        return;
                      }
                      addToCart(p).catch((err) => notify(err.message, 'error'));
                    }}
                  >
                    Add to cart
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
