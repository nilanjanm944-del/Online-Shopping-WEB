/** 404 page with useful navigation back into the store. */
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="font-display text-6xl font-bold text-brand-600">404</p>
      <h1 className="mt-3 font-display text-2xl font-bold">We couldn't find that page</h1>
      <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
        The link may be broken or the product may have been removed. Try searching the catalogue instead.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button as={Link} to="/">Back to home</Button>
        <Button as={Link} to="/shop" variant="secondary">Browse the shop</Button>
        <Button as={Link} to="/help" variant="ghost">Help centre</Button>
      </div>
    </div>
  );
}
