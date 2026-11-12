/** Authentication pages: login, registration, password reset. */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../context/StoreProvider';
import { Button, Field, Input, cx } from '../components/ui';

function AuthShell({ title, subtitle, children, footer }) {
  const { brand } = useStore();
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-16">
      <div className="hidden flex-col justify-center lg:flex">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{brand?.name || 'ZYREX STORE'}</p>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight">
          Shop ten departments with one secure account.
        </h2>
        <ul className="mt-6 space-y-3 text-sm text-ink-600 dark:text-ink-300">
          {[
            'Track every order with a live status timeline',
            'Save addresses and reorder in one tap',
            'Keep a synced cart and wishlist across devices',
            'Secure checkout with Razorpay or Cash on Delivery',
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-brand-600">✓</span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card dark:border-ink-800 dark:bg-ink-900">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{subtitle}</p>}
        <div className="mt-5">{children}</div>
        {footer && <div className="mt-5 border-t border-ink-200 pt-4 text-sm dark:border-ink-800">{footer}</div>}
      </div>
    </div>
  );
}

function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
      {children}
    </p>
  );
}

export function Login() {
  const { login, user } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const redirect = location.state?.from || '/account';

  useEffect(() => {
    if (user) navigate(redirect, { replace: true });
  }, [user, navigate, redirect]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.email.trim(), form.password);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your orders, wishlist and saved addresses."
      footer={
        <p className="text-ink-600 dark:text-ink-300">
          New to ZYREX? <Link to="/register" className="font-semibold text-brand-600 hover:underline">Create an account</Link>
        </p>
      }
    >
      <form onSubmit={submit}>
        <ErrorNote>{error}</ErrorNote>
        <Field label="Email address" required>
          <Input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password" required className="mt-4">
          <Input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        <div className="mt-2 text-right">
          <Link to="/forgot-password" className="text-xs font-semibold text-brand-600 hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" className="mt-4 w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { register, user } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate('/account', { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      navigate('/account', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes less than a minute."
      footer={
        <p className="text-ink-600 dark:text-ink-300">
          Already registered? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
        </p>
      }
    >
      <form onSubmit={submit}>
        <ErrorNote>{error}</ErrorNote>
        <Field label="Full name" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} autoComplete="name" />
        </Field>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Email address" required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
          </Field>
          <Field label="Mobile number" hint="Used for delivery updates.">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="numeric" autoComplete="tel" placeholder="10-digit number" />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Password" required hint="Minimum 8 characters.">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" required>
            <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required autoComplete="new-password" />
          </Field>
        </div>
        <Button type="submit" className="mt-4 w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
          By creating an account you agree to our <Link to="/terms" className="underline">Terms</Link> and{' '}
          <Link to="/privacy-policy" className="underline">Privacy policy</Link>. Passwords are stored only as salted hashes.
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim() });
      setMessage(res.message || 'If that email is registered, a reset link has been sent.');
      if (res.reset_token) setToken(res.reset_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email address linked to your account."
      footer={<Link to="/login" className="font-semibold text-brand-600 hover:underline">← Back to sign in</Link>}
    >
      <form onSubmit={submit}>
        <ErrorNote>{error}</ErrorNote>
        <Field label="Email address" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </Field>
        <Button type="submit" className="mt-4 w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
      </form>
      {message && (
        <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          {message}
          {token && (
            <p className="mt-2 break-all text-xs">
              Email delivery is not configured, so continue here:{' '}
              <Link to={`/reset-password?token=${encodeURIComponent(token)}`} className="font-semibold underline">
                open reset form
              </Link>
            </p>
          )}
        </div>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ token: params.get('token') || '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token: form.token.trim(), password: form.password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Choose a new password" subtitle="Your reset link can be used once.">
      {done ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          Password updated. Redirecting you to sign in…
        </p>
      ) : (
        <form onSubmit={submit}>
          <ErrorNote>{error}</ErrorNote>
          <Field label="Reset token" required hint="Pasted from your reset email or link.">
            <Input value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} required />
          </Field>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="New password" required>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" />
            </Field>
            <Field label="Confirm password" required>
              <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required autoComplete="new-password" />
            </Field>
          </div>
          <Button type="submit" className="mt-4 w-full" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</Button>
        </form>
      )}
    </AuthShell>
  );
}
