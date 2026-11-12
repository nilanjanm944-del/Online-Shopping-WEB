/** Content pages: blog, vlog, FAQ, help centre, contact, about and policies. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../context/StoreProvider';
import { dateFmt } from '../lib/format';
import {
  Badge, Breadcrumbs, Button, EmptyState, Field, Input, PageLoader, Section, SmartImage, Textarea, cx,
} from '../components/ui';

/* ------------------------------- helpers ------------------------------- */

function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get(path)
      .then((res) => alive && setData(res))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading, error };
}

function PageHeader({ title, subtitle, crumbs }) {
  return (
    <div className="border-b border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {crumbs && <Breadcrumbs items={crumbs} />}
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">{subtitle}</p>}
      </div>
    </div>
  );
}

/* -------------------------------- blog --------------------------------- */

export function Blog() {
  const { data, loading } = useApi('/blog');
  const posts = data?.posts || [];
  return (
    <>
      <PageHeader
        title="Blog & buying guides"
        subtitle="Product reviews, comparisons, buying guides and shopping tips from the ZYREX editorial desk."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Blog' }]}
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <PageLoader />
        ) : posts.length === 0 ? (
          <EmptyState icon="📝" title="No articles yet" text="New guides are published every week." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article key={post.id} className="overflow-hidden rounded-2xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
                <Link to={`/blog/${post.slug}`}>
                  <SmartImage src={post.cover_image} alt={post.title} wrapperClass="aspect-[16/9]" className="h-full w-full object-cover" />
                </Link>
                <div className="p-4">
                  <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                    <Badge tone="brand">{post.category || 'Guide'}</Badge>
                    <span>{dateFmt(post.published_at || post.created_at)}</span>
                  </div>
                  <h2 className="mt-2 font-display text-base font-semibold">
                    <Link to={`/blog/${post.slug}`} className="hover:text-brand-600">{post.title}</Link>
                  </h2>
                  <p className="mt-1 line-clamp-3 text-sm text-ink-600 dark:text-ink-300">{post.excerpt}</p>
                  <Link to={`/blog/${post.slug}`} className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline">
                    Read article →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const { data, loading, error } = useApi(`/blog/${slug}`, [slug]);
  if (loading) return <PageLoader />;
  if (error || !data?.post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState icon="📄" title="Article not found" action={<Button as={Link} to="/blog">Back to blog</Button>} />
      </div>
    );
  }
  const { post, related = [] } = data;
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Blog', to: '/blog' }, { label: post.title }]} />
      <Badge tone="brand">{post.category || 'Guide'}</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold leading-tight">{post.title}</h1>
      <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
        By {post.author || 'ZYREX editorial'} · {dateFmt(post.published_at || post.created_at)}
      </p>
      <SmartImage src={post.cover_image} alt={post.title} wrapperClass="mt-5 aspect-[16/9] rounded-2xl" className="h-full w-full object-cover" />
      <div className="prose-zyrex mt-6 space-y-4 text-[15px] leading-relaxed text-ink-700 dark:text-ink-300">
        {String(post.body || post.content || '')
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((para, i) => (
            <p key={i}>{para}</p>
          ))}
      </div>
      {related.length > 0 && (
        <div className="mt-10 border-t border-ink-200 pt-6 dark:border-ink-800">
          <h2 className="font-display text-lg font-semibold">More articles</h2>
          <ul className="mt-3 space-y-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link to={`/blog/${r.slug}`} className="text-sm font-semibold text-brand-600 hover:underline">{r.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/* -------------------------------- vlog --------------------------------- */

export function Vlog() {
  const { data, loading } = useApi('/vlog');
  const posts = data?.posts || [];
  return (
    <>
      <PageHeader
        title="Vlogs & product videos"
        subtitle="Unboxings, demonstrations and reviews from official brand channels on YouTube."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Vlog' }]}
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <PageLoader />
        ) : posts.length === 0 ? (
          <EmptyState icon="🎬" title="No videos yet" text="Video content is added regularly." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article key={post.id} className="overflow-hidden rounded-2xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
                <div className="aspect-video w-full bg-black">
                  {post.youtube_id ? (
                    <iframe
                      className="h-full w-full"
                      src={`https://www.youtube-nocookie.com/embed/${post.youtube_id}`}
                      title={post.title}
                      loading="lazy"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/70">Video unavailable</div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-display text-base font-semibold">{post.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-600 dark:text-ink-300">{post.excerpt || post.description}</p>
                  <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">{dateFmt(post.published_at || post.created_at)}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* --------------------------------- FAQ --------------------------------- */

export function Faq() {
  const { data, loading } = useApi('/faqs');
  const [open, setOpen] = useState(null);
  const faqs = data?.faqs || [];
  return (
    <>
      <PageHeader
        title="Frequently asked questions"
        subtitle="Answers about orders, delivery, payments, returns and your account."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'FAQ' }]}
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {loading ? (
          <PageLoader />
        ) : (
          <ul className="space-y-2">
            {faqs.map((f, i) => (
              <li key={i} className="rounded-2xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold"
                  aria-expanded={open === i}
                >
                  {f.question || f.q}
                  <span className="text-brand-600">{open === i ? '−' : '+'}</span>
                </button>
                {open === i && (
                  <p className="border-t border-ink-200 px-4 py-3 text-sm text-ink-600 dark:border-ink-800 dark:text-ink-300">
                    {f.answer || f.a}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* -------------------------------- help --------------------------------- */

export function Help() {
  const { brand } = useStore();
  const cards = [
    { icon: '📦', title: 'Track your order', text: 'See live status with your order number and email.', to: '/track', label: 'Track order' },
    { icon: '↩️', title: 'Returns & refunds', text: '7-day returns on most categories; refunds in 3–5 days.', to: '/return-policy', label: 'Return policy' },
    { icon: '🚚', title: 'Shipping information', text: 'Free delivery over ₹499, dispatch within 24 hours.', to: '/shipping-policy', label: 'Shipping policy' },
    { icon: '💬', title: 'Contact support', text: 'Raise a ticket and our team replies within 24 hours.', to: '/contact', label: 'Contact us' },
    { icon: '❓', title: 'FAQs', text: 'Quick answers to the most common questions.', to: '/faq', label: 'Read FAQs' },
    { icon: '🔐', title: 'Account & security', text: 'Manage your password, addresses and sessions.', to: '/account/settings', label: 'Account settings' },
  ];
  return (
    <>
      <PageHeader title="Help centre" subtitle="Everything you need to shop with confidence." crumbs={[{ label: 'Home', to: '/' }, { label: 'Help' }]} />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={c.title}
              to={c.to}
              className="rounded-2xl border border-ink-200 bg-white p-5 transition hover:border-brand-400 hover:shadow-card dark:border-ink-800 dark:bg-ink-900"
            >
              <span className="text-2xl">{c.icon}</span>
              <h2 className="mt-2 font-display text-base font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{c.text}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-brand-600">{c.label} →</span>
            </Link>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-ink-200 bg-white p-5 text-sm dark:border-ink-800 dark:bg-ink-900">
          <h2 className="font-display text-base font-semibold">Still need help?</h2>
          <p className="mt-1 text-ink-600 dark:text-ink-300">
            Email <a className="font-semibold text-brand-600" href={`mailto:${brand?.support_email}`}>{brand?.support_email || 'support@zyrexstore.com'}</a>
            {brand?.support_phone ? ` or call ${brand.support_phone}` : ''}
            {brand?.support_hours ? ` · ${brand.support_hours}` : ''}.
          </p>
        </div>
      </div>
    </>
  );
}

/* ------------------------------- contact -------------------------------- */

export function Contact() {
  const { brand, notify, user } = useStore();
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    subject: '',
    message: '',
    order_number: '',
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/contact', form);
      setDone(res.message || 'Your message has been received. We reply within 24 hours.');
      notify('Support request submitted');
      setForm({ ...form, subject: '', message: '', order_number: '' });
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Contact us" subtitle="Questions about an order, a product or a return? Send us a message." crumbs={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} />
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit} className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
            <Field label="Mobile number">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />
            </Field>
            <Field label="Order number" hint="Optional — helps us respond faster.">
              <Input value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} placeholder="ZRX-…" />
            </Field>
          </div>
          <Field label="Subject" required className="mt-4">
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
          </Field>
          <Field label="Message" required className="mt-4">
            <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required minLength={10} rows={5} />
          </Field>
          {done && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {done}
            </p>
          )}
          <Button type="submit" className="mt-4" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</Button>
        </form>

        <aside className="space-y-3 text-sm">
          <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
            <h2 className="font-display text-base font-semibold">Support</h2>
            <p className="mt-2 text-ink-600 dark:text-ink-300">{brand?.support_email || 'support@zyrexstore.com'}</p>
            <p className="text-ink-600 dark:text-ink-300">{brand?.support_phone || '+91 90000 00000'}</p>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{brand?.support_hours || 'Mon–Sat, 9:00 AM – 8:00 PM IST'}</p>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
            <h2 className="font-display text-base font-semibold">Registered address</h2>
            <p className="mt-2 whitespace-pre-line text-ink-600 dark:text-ink-300">{brand?.address || 'ZYREX Commerce Pvt. Ltd.\nKolkata, West Bengal, India'}</p>
          </div>
        </aside>
      </div>
    </>
  );
}

/* -------------------------------- about --------------------------------- */

export function About() {
  const { brand } = useStore();
  return (
    <>
      <PageHeader
        title={`About ${brand?.name || 'ZYREX STORE'}`}
        subtitle={brand?.tagline || 'A modern Indian marketplace for fashion, electronics, home, grocery and more.'}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'About' }]}
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="space-y-4 text-[15px] leading-relaxed text-ink-700 dark:text-ink-300">
          <p>
            ZYREX STORE is a demonstration multi-category marketplace built to show how a complete shopping
            experience works end to end: catalogue discovery, cart and wishlist, secure checkout, order
            tracking and a role-based administration console.
          </p>
          <p>
            The storefront covers ten departments — fashion, electronics, home and kitchen, grocery, beauty,
            sports, books, toys, automotive and pet supplies — with filters, sorting, comparisons and
            rule-based recommendations.
          </p>
          <p>
            All product names, prices, ratings and images in this build are sample data for demonstration.
            Generated artwork is used instead of third-party photography so nothing copyrighted is republished,
            and no product is presented as a verified branded item.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['10', 'Departments'],
            ['169+', 'Demo products'],
            ['24h', 'Support response'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-ink-200 bg-white p-4 text-center dark:border-ink-800 dark:bg-ink-900">
              <p className="font-display text-2xl font-bold text-brand-600">{value}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------- policies ------------------------------- */

const POLICIES = {
  shipping: {
    title: 'Shipping policy',
    sections: [
      ['Dispatch', 'Orders are dispatched within 24 working hours. You receive a tracking timeline in My Orders and on the Track Order page.'],
      ['Delivery time', 'Metro cities: 2–4 working days. Rest of India: 4–7 working days. Remote PIN codes may take longer.'],
      ['Charges', 'Delivery is free on orders of ₹499 and above. Below that a flat ₹49 delivery fee applies.'],
      ['Cash on Delivery', 'COD is available on eligible orders up to ₹5,000. The limit is configurable by the store administrator.'],
    ],
  },
  returns: {
    title: 'Return and refund policy',
    sections: [
      ['Return window', 'Most categories can be returned within 7 days of delivery in original condition with tags and packaging intact.'],
      ['Non-returnable items', 'Innerwear, perishable grocery items, opened beauty products and personalised goods cannot be returned.'],
      ['How to request', 'Open My Orders → select the order → Request return. Our team arranges a pickup.'],
      ['Refunds', 'Prepaid refunds are processed to the original payment method within 3–5 working days after quality check. COD refunds are made by bank transfer.'],
    ],
  },
  privacy: {
    title: 'Privacy policy',
    sections: [
      ['What we collect', 'Name, email, phone, delivery addresses, order history and wishlist. Passwords are stored only as bcrypt hashes.'],
      ['How we use it', 'To fulfil orders, provide support and improve the catalogue. We never sell personal data.'],
      ['Payments', 'Card numbers and CVV are never stored on our servers. Online payments are handled by Razorpay and verified server-side.'],
      ['Your rights', 'You can update or delete your profile data from Account settings, or contact support to request deletion.'],
    ],
  },
  terms: {
    title: 'Terms and conditions',
    sections: [
      ['Use of the store', 'You agree to provide accurate account and delivery information and not to misuse the platform.'],
      ['Pricing', 'All prices are in Indian Rupees and include applicable taxes. Demo prices and products in this build are samples.'],
      ['Orders', 'An order is confirmed only after payment verification (prepaid) or order placement (COD). We may cancel orders with stock or verification issues and refund in full.'],
      ['Liability', 'This is a demonstration store; product availability, delivery estimates and ratings are sample data.'],
    ],
  },
};

export function Policy({ kind = 'shipping' }) {
  const policy = POLICIES[kind] || POLICIES.shipping;
  return (
    <>
      <PageHeader title={policy.title} crumbs={[{ label: 'Home', to: '/' }, { label: policy.title }]} />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="space-y-5">
          {policy.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="font-display text-lg font-semibold">{heading}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-700 dark:text-ink-300">{body}</p>
            </section>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-ink-200 bg-white p-4 text-sm dark:border-ink-800 dark:bg-ink-900">
          Need more detail? Visit the <Link to="/help" className="font-semibold text-brand-600 hover:underline">Help Centre</Link> or{' '}
          <Link to="/contact" className="font-semibold text-brand-600 hover:underline">contact support</Link>.
        </div>
      </div>
    </>
  );
}
