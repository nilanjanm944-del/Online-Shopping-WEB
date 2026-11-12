/** Dedicated administrator sign-in. Admin rights are enforced by the API, not this page. */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreProvider';
import { Button, Field, Input } from '../components/ui';

export default function AdminLogin() {
  const { login, user, isAdmin, notify } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const redirectTo = location.state?.from || '/admin';

  useEffect(() => {
    if (isAdmin) navigate(redirectTo, { replace: true });
  }, [isAdmin, navigate, redirectTo]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const account = await login(form.email.trim(), form.password);
      if (account.role !== 'admin') {
        setError('This account does not have administrator access.');
        return;
      }
      notify('Signed in as administrator');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8 dark:border-ink-800 dark:bg-ink-900">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">ZYREX STORE</p>
        <h1 className="mt-1 font-display text-2xl font-bold">Administrator sign-in</h1>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
          Restricted area. Role checks run on the server for every admin request.
        </p>

        {user && !isAdmin && (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            You are signed in as {user.email} without administrator rights.
          </p>
        )}

        <form onSubmit={submit} className="mt-5 space-y-3">
          <Field label="Admin email" required>
            <Input
              type="email"
              autoComplete="username"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>
          <Field label="Password" required>
            <Input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </Field>
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Verifying…' : 'Sign in to dashboard'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-500 dark:text-ink-400">
          <Link to="/" className="font-semibold text-brand-600 hover:underline">Back to store</Link>
        </p>
      </div>
    </div>
  );
}
