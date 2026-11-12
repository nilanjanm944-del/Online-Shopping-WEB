/** All-categories index with department banners and subcategory links. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, imageUrl } from '../lib/api';
import { Breadcrumbs, PageLoader, SmartImage } from '../components/ui';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/categories')
      .then((res) => setCategories(res.categories || []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader label="Loading categories…" />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'All categories' }]} />
      <h1 className="mt-3 font-display text-2xl font-extrabold text-ink-900 sm:text-3xl dark:text-white">All categories</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-500 dark:text-ink-400">
        Ten departments and their subcategories. Every link opens a filtered catalogue page.
      </p>

      <div className="mt-6 space-y-4">
        {categories.map((c) => (
          <section key={c.slug} className="overflow-hidden rounded-2xl border border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900">
            <div className="grid gap-4 p-4 sm:grid-cols-[200px_1fr] sm:p-5">
              <Link to={`/category/${c.slug}`} className="group">
                <SmartImage
                  src={imageUrl(`/api/img/category/${c.slug}.svg?glyph=${c.glyph}&hue=${c.hue}&label=${encodeURIComponent(c.name)}&w=400&h=300`)}
                  alt={c.name}
                  wrapperClass="aspect-[4/3] w-full rounded-xl"
                  className="transition duration-500 group-hover:scale-105"
                />
              </Link>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/category/${c.slug}`} className="font-display text-lg font-bold text-ink-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300">
                    {c.name}
                  </Link>
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300">{c.product_count} products</span>
                </div>
                <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{c.tagline}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(c.subcategories || []).map((s) => (
                    <Link
                      key={s.slug}
                      to={`/category/${c.slug}?subcategory=${s.slug}`}
                      className="rounded-full border border-ink-200 px-2.5 py-1 text-[11px] font-medium text-ink-600 transition hover:border-brand-400 hover:text-brand-700 dark:border-ink-700 dark:text-ink-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
                <Link to={`/category/${c.slug}`} className="mt-3 inline-block text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  Shop {c.name} →
                </Link>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
