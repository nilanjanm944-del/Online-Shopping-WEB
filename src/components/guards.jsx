/** Route guards, scroll restoration and the app-level error boundary. */
import { Component, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreProvider';
import { PageLoader } from './ui';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui] render error', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <p className="mb-2 text-4xl">⚠️</p>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
            This section could not be displayed. Your cart and account are safe.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={() => this.setState({ error: null })} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white">
              Try again
            </button>
            <a href="/" className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-bold text-ink-700 dark:border-ink-700 dark:text-ink-200">
              Go home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, search]);
  return null;
}

export function RequireAuth() {
  const { user, ready } = useStore();
  const location = useLocation();
  if (!ready) return <PageLoader label="Checking your session…" />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { user, ready, isAdmin } = useStore();
  if (!ready) return <PageLoader label="Checking permissions…" />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="mb-2 text-4xl">🔒</p>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Administrator access required</h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          Your account does not have administrator permissions. Sign in with an admin account to continue.
        </p>
        <a href="/admin/login" className="mt-5 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white">Admin sign in</a>
      </div>
    );
  }
  return <Outlet />;
}

export function RequireGuest({ children }) {
  const { user } = useStore();
  if (user) return <Navigate to="/account" replace />;
  return children;
}
