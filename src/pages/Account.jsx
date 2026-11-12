/** Customer account area: profile, saved addresses and security settings. */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../context/StoreProvider';
import { dateFmt, initials } from '../lib/format';
import { Badge, Button, Field, Input, Modal, PageLoader, cx } from '../components/ui';

const TABS = [
  { to: '/account', label: 'Profile', end: true },
  { to: '/account/orders', label: 'My orders' },
  { to: '/account/addresses', label: 'Addresses' },
  { to: '/account/settings', label: 'Settings' },
];

export default function Account() {
  const { user, logout, cart } = useStore();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {initials(user?.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-xs text-ink-500 dark:text-ink-400">{user?.email}</p>
              </div>
            </div>
            {user?.role === 'admin' && (
              <Link to="/admin" className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:underline">
                Open admin dashboard →
              </Link>
            )}
          </div>
          <nav className="overflow-hidden rounded-2xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cx(
                    'block border-b border-ink-100 px-4 py-3 text-sm last:border-0 dark:border-ink-800',
                    isActive ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/20 dark:text-brand-300' : 'hover:bg-ink-50 dark:hover:bg-ink-800/60'
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
            <button type="button" onClick={signOut} className="block w-full px-4 py-3 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
              Sign out
            </button>
          </nav>
          <div className="rounded-2xl border border-ink-200 bg-white p-4 text-xs text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300">
            <p className="font-semibold text-ink-900 dark:text-white">Cart items</p>
            <p className="mt-1">{cart?.count || 0} item(s) ready for checkout</p>
            <Link to="/cart" className="mt-2 inline-block font-semibold text-brand-600 hover:underline">View cart →</Link>
          </div>
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}

export function AccountProfile() {
  const { user, refreshUser, notify } = useStore();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({ name: user?.name || '', phone: user?.phone || '' });
  }, [user?.name, user?.phone]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch('/auth/profile', form);
      await refreshUser();
      notify('Profile updated');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
        <h1 className="font-display text-xl font-bold">Your profile</h1>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">Member since {dateFmt(user?.created_at)}</p>
        <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
          </Field>
          <Field label="Mobile number">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="numeric" />
          </Field>
          <Field label="Email address" hint="Contact support to change your email.">
            <Input value={user?.email || ''} readOnly disabled />
          </Field>
          <Field label="Account type">
            <Input value={user?.role === 'admin' ? 'Administrator' : 'Customer'} readOnly disabled />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </form>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/account/orders" className="rounded-2xl border border-ink-200 bg-white p-4 hover:border-brand-400 dark:border-ink-800 dark:bg-ink-900">
          <p className="text-sm font-semibold">My orders</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Track and manage purchases</p>
        </Link>
        <Link to="/wishlist" className="rounded-2xl border border-ink-200 bg-white p-4 hover:border-brand-400 dark:border-ink-800 dark:bg-ink-900">
          <p className="text-sm font-semibold">Wishlist</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Products you saved</p>
        </Link>
        <Link to="/account/addresses" className="rounded-2xl border border-ink-200 bg-white p-4 hover:border-brand-400 dark:border-ink-800 dark:bg-ink-900">
          <p className="text-sm font-semibold">Addresses</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Delivery locations</p>
        </Link>
      </div>
    </div>
  );
}

const EMPTY_ADDRESS = {
  full_name: '',
  phone: '',
  email: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  label: 'Home',
  is_default: false,
};

export function AccountAddresses() {
  const { user, notify } = useStore();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/auth/addresses');
      setAddresses(res.addresses || []);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setForm({ ...EMPTY_ADDRESS, full_name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
    setEditing('new');
  };

  const openEdit = (address) => {
    setForm({ ...EMPTY_ADDRESS, ...address });
    setEditing(address.id);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing === 'new') await api.post('/auth/addresses', form);
      else await api.patch(`/auth/addresses/${editing}`, form);
      setEditing(null);
      await load();
      notify('Address saved');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeAddress = async (id) => {
    try {
      await api.del(`/auth/addresses/${id}`);
      await load();
      notify('Address removed');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Saved addresses</h1>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">Used at checkout for faster delivery.</p>
        </div>
        <Button onClick={openNew}>Add address</Button>
      </div>

      {addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 p-8 text-center dark:border-ink-700">
          <p className="text-sm font-semibold">No addresses saved yet</p>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Add a delivery address to speed up checkout.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{a.full_name}</p>
                <div className="flex items-center gap-1">
                  {a.label && <Badge>{a.label}</Badge>}
                  {a.is_default && <Badge tone="brand">Default</Badge>}
                </div>
              </div>
              <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
                {[a.line1, a.line2, a.landmark].filter(Boolean).join(', ')}<br />
                {a.city}, {a.state} — {a.pincode}<br />
                {a.phone}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(a)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => removeAddress(a.id)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add address' : 'Edit address'}>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </Field>
          <Field label="Mobile number" required>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required inputMode="numeric" />
          </Field>
          <Field label="Email" className="sm:col-span-2" required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Address line 1" className="sm:col-span-2" required>
            <Input value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required placeholder="House / flat, building, street" />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <Input value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} placeholder="Area, colony" />
          </Field>
          <Field label="Landmark">
            <Input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
          </Field>
          <Field label="City" required>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
          </Field>
          <Field label="State" required>
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
          </Field>
          <Field label="PIN code" required>
            <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} required inputMode="numeric" maxLength={6} />
          </Field>
          <Field label="Label">
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Home / Office" />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(form.is_default)}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
            />
            Make this my default address
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function AccountSettings() {
  const { notify, theme, toggleTheme, lang, setLang, clearRecent, logout } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) {
      notify('The two passwords do not match.', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setForm({ current_password: '', new_password: '', confirm: '' });
      notify('Password changed');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
        <h1 className="font-display text-xl font-bold">Change password</h1>
        <form onSubmit={changePassword} className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Current password" required>
            <Input type="password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} required autoComplete="current-password" />
          </Field>
          <Field label="New password" required hint="Minimum 8 characters.">
            <Input type="password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" required>
            <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required autoComplete="new-password" />
          </Field>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</Button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
        <h2 className="font-display text-lg font-bold">Preferences</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Appearance</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Currently using {theme} mode.</p>
            </div>
            <Button variant="secondary" onClick={toggleTheme}>{theme === 'dark' ? 'Switch to light' : 'Switch to dark'}</Button>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
            <div>
              <p className="font-semibold">Language</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">English and Bengali are supported.</p>
            </div>
            <div className="flex gap-1">
              {[
                ['en', 'English'],
                ['bn', 'বাংলা'],
              ].map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={cx(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold',
                    lang === code ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
            <div>
              <p className="font-semibold">Recently viewed</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Clear the browsing history stored on this device.</p>
            </div>
            <Button variant="ghost" onClick={() => { clearRecent(); notify('Browsing history cleared'); }}>Clear</Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
        <h2 className="font-display text-lg font-bold">Session</h2>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
          Signing out clears your secure session cookie on this device.
        </p>
        <Button
          variant="danger"
          className="mt-3"
          onClick={async () => {
            await logout();
            navigate('/', { replace: true });
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
