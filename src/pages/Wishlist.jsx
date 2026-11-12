/** Wishlist: saved products with move-to-cart and remove actions. */
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreProvider';
import { inr } from '../lib/format';
import { Breadcrumbs, Button, EmptyState, Price, SmartImage, Stars } from '../components/ui';

export default function Wishlist() {
  const { wishlist, toggleWishlist, addToCart, notify } = useStore();

  const moveToCart = async (product) => {
    if (product.sizes?.length || product.colors?.length) {
      notify('Choose a size and colour on the product page', 'info');
      return;
    }
    try {
      await addToCart(product, { qty: 1 });
      await toggleWishlist(product);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Wishlist' }]} />
      <h1 className="font-display text-2xl font-bold sm:text-3xl">
        My wishlist <span className="text-base font-medium text-ink-500">({wishlist.length})</span>
      </h1>

      {wishlist.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="♡"
            title="Nothing saved yet"
            text="Tap the heart on any product to save it for later."
            action={<Button as={Link} to="/shop">Browse products</Button>}
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {wishlist.map((p) => (
            <article
              key={p.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900"
            >
              <Link to={`/product/${p.slug}`}>
                <SmartImage
                  src={p.images?.[0]}
                  alt={p.name}
                  wrapperClass="aspect-[4/3]"
                  className="h-full w-full object-cover"
                />
              </Link>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{p.brand}</p>
                <Link to={`/product/${p.slug}`} className="line-clamp-2 text-sm font-semibold hover:text-brand-600">
                  {p.name}
                </Link>
                <Stars value={p.rating} count={p.review_count} />
                <Price price={p.price} mrp={p.mrp} size="sm" />
                <div className="mt-auto flex flex-col gap-1.5 pt-2">
                  <Button size="sm" onClick={() => moveToCart(p)}>Move to cart</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleWishlist(p)}>Remove</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
