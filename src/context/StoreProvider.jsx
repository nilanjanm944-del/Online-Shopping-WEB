/**
 * Global storefront state: session, cart, wishlist, theme, language, toasts.
 *
 * A signed-in cart/wishlist lives on the server (prices are always recalculated
 * there). Guests get a localStorage cart that is merged into the account right
 * after sign-in, so nothing is lost.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';

const StoreContext = createContext(null);

const KEYS = {
  cart: 'zyrex.cart.v1',
  wish: 'zyrex.wishlist.v1',
  theme: 'zyrex.theme',
  recent: 'zyrex.recent.v1',
  compare: 'zyrex.compare.v1',
  coupon: 'zyrex.coupon',
  lang: 'zyrex.lang',
};

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable in private mode */
  }
};

const EMPTY_CART = {
  items: [],
  count: 0,
  subtotal: 0,
  mrp_total: 0,
  discount: 0,
  shipping: 0,
  total: 0,
  savings: 0,
  coupon: null,
};

/** Totals for the guest cart (the server re-checks everything at checkout). */
export function guestTotals(items, commerce = {}, coupon = null) {
  const rows = items.map((i) => ({
    ...i,
    line_total: i.price * i.qty,
    line_mrp: i.mrp * i.qty,
    in_stock: (i.stock ?? 0) > 0,
  }));
  const subtotal = rows.reduce((s, i) => s + i.line_total, 0);
  const mrpTotal = rows.reduce((s, i) => s + i.line_mrp, 0);
  const discount = coupon ? Number(coupon.discount) || 0 : 0;
  const freeShip = Boolean(coupon?.free_shipping) || subtotal >= (commerce.free_shipping_threshold ?? 999);
  const shipping = subtotal === 0 || freeShip ? 0 : Number(commerce.shipping_fee ?? 49);
  return {
    items: rows,
    count: rows.reduce((s, i) => s + i.qty, 0),
    subtotal,
    mrp_total: mrpTotal,
    discount,
    shipping,
    total: Math.max(0, subtotal - discount) + shipping,
    savings: mrpTotal - subtotal + discount,
    coupon,
  };
}

export function StoreProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState(EMPTY_CART);
  const [guestCart, setGuestCart] = useState(() => read(KEYS.cart, []));
  const [wishlist, setWishlist] = useState([]);
  const [guestWish, setGuestWish] = useState(() => read(KEYS.wish, []));
  const [coupon, setCoupon] = useState(() => read(KEYS.coupon, null));
  const [theme, setTheme] = useState(() => read(KEYS.theme, 'light'));
  const [lang, setLang] = useState(() => read(KEYS.lang, 'en'));
  const [recent, setRecent] = useState(() => read(KEYS.recent, []));
  const [compare, setCompare] = useState(() => read(KEYS.compare, []));
  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);

  const notify = useCallback((message, tone = 'success') => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t.slice(-3), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /* ------------------------------ bootstrap ------------------------------ */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [site, me] = await Promise.all([
        api.get('/site').catch(() => null),
        api.get('/auth/me').catch(() => null),
      ]);
      if (!alive) return;
      if (site) setSettings(site);
      if (me?.user) setUser(me.user);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* Theme + language side effects. */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    write(KEYS.theme, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    write(KEYS.lang, lang);
  }, [lang]);

  /* Guest totals recompute locally whenever the guest cart changes. */
  useEffect(() => {
    if (!user) setCart(guestTotals(guestCart, settings?.commerce, coupon));
  }, [guestCart, coupon, settings, user]);

  /* On sign-in: merge the guest cart/wishlist, then load server state. */
  useEffect(() => {
    if (!ready) return undefined;
    if (!user) {
      setWishlist([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      if (guestCart.length) {
        await api
          .post('/cart/merge', {
            items: guestCart.map(({ product_id, qty, size, color }) => ({ product_id, qty, size, color })),
          })
          .catch(() => null);
        if (!cancelled) {
          setGuestCart([]);
          write(KEYS.cart, []);
        }
      }
      for (const entry of guestWish) {
        await api.post('/wishlist', { product_id: entry.product_id }).catch(() => null);
      }
      if (guestWish.length && !cancelled) {
        setGuestWish([]);
        write(KEYS.wish, []);
      }
      const query = coupon?.code ? `?coupon=${encodeURIComponent(coupon.code)}` : '';
      const [cartData, wishData] = await Promise.all([
        api.get(`/cart${query}`).catch(() => null),
        api.get('/wishlist').catch(() => null),
      ]);
      if (cancelled) return;
      if (cartData) setCart(cartData);
      if (wishData) setWishlist(wishData.items || []);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id]);

  const refreshCart = useCallback(
    async (code = coupon?.code) => {
      const data = await api
        .get(`/cart${code ? `?coupon=${encodeURIComponent(code)}` : ''}`)
        .catch(() => null);
      if (data) setCart(data);
      return data;
    },
    [coupon?.code]
  );

  const refreshWishlist = useCallback(async () => {
    if (!user) return;
    const data = await api.get('/wishlist').catch(() => null);
    if (data) setWishlist(data.items || []);
  }, [user]);

  /* -------------------------------- auth -------------------------------- */
  const login = useCallback(
    async (email, password) => {
      const data = await api.post('/auth/login', { email, password });
      setUser(data.user);
      return data.user;
    },
    []
  );

  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload);
    if (data.user) setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => null);
    setUser(null);
    setCart(EMPTY_CART);
    setWishlist([]);
    notify('Signed out', 'info');
  }, [notify]);

  const refreshUser = useCallback(async () => {
    const data = await api.get('/auth/me').catch(() => null);
    if (data?.user) setUser(data.user);
    return data?.user || null;
  }, []);

  /* -------------------------------- cart -------------------------------- */
  const addToCart = useCallback(
    async (product, { qty = 1, size = null, color = null, silent = false } = {}) => {
      if (user) {
        const data = await api.post('/cart', {
          product_id: product.id,
          qty,
          size,
          color,
          coupon: coupon?.code || undefined,
        });
        setCart(data);
      } else {
        const key = `${product.id}:${size || ''}:${color || ''}`;
        setGuestCart((prev) => {
          const existing = prev.find((i) => i.id === key);
          const next = existing
            ? prev.map((i) => (i.id === key ? { ...i, qty: Math.min(i.stock || 10, i.qty + qty) } : i))
            : [
                ...prev,
                {
                  id: key,
                  product_id: product.id,
                  slug: product.slug,
                  name: product.name,
                  brand: product.brand,
                  image: product.images?.[0],
                  price: product.price,
                  mrp: product.mrp,
                  stock: product.stock,
                  qty,
                  size,
                  color,
                },
              ];
          write(KEYS.cart, next);
          return next;
        });
      }
      if (!silent) notify(`${product.name} added to cart`);
    },
    [user, coupon?.code, notify]
  );

  const updateQty = useCallback(
    async (item, qty) => {
      const next = Math.max(0, Math.min(10, Number(qty) || 0));
      if (user) {
        const data =
          next === 0
            ? await api.del(`/cart/${item.id}?coupon=${encodeURIComponent(coupon?.code || '')}`)
            : await api.patch(`/cart/${item.id}`, { qty: next, coupon: coupon?.code });
        setCart(data);
      } else {
        setGuestCart((prev) => {
          const rows = next === 0 ? prev.filter((i) => i.id !== item.id) : prev.map((i) => (i.id === item.id ? { ...i, qty: next } : i));
          write(KEYS.cart, rows);
          return rows;
        });
      }
    },
    [user, coupon?.code]
  );

  const removeItem = useCallback(
    async (item) => {
      if (user) {
        const data = await api.del(`/cart/${item.id}?coupon=${encodeURIComponent(coupon?.code || '')}`);
        setCart(data);
      } else {
        setGuestCart((prev) => {
          const rows = prev.filter((i) => i.id !== item.id);
          write(KEYS.cart, rows);
          return rows;
        });
      }
      notify('Item removed from cart', 'info');
    },
    [user, coupon?.code, notify]
  );

  const clearCart = useCallback(async () => {
    if (user) {
      const data = await api.del('/cart');
      setCart(data);
    } else {
      setGuestCart([]);
      write(KEYS.cart, []);
    }
  }, [user]);

  const applyCoupon = useCallback(
    async (code) => {
      const clean = String(code || '').trim().toUpperCase();
      if (!clean) throw new Error('Enter a coupon code.');
      const subtotal = user ? cart.subtotal : guestTotals(guestCart, settings?.commerce, null).subtotal;
      const result = await api.post('/coupons/validate', { code: clean, subtotal });
      const stored = {
        code: clean,
        discount: result.discount || 0,
        free_shipping: Boolean(result.free_shipping),
        description: result.coupon?.description || '',
      };
      setCoupon(stored);
      write(KEYS.coupon, stored);
      if (user) {
        const data = await api.get(`/cart?coupon=${encodeURIComponent(clean)}`);
        setCart(data);
      }
      notify(result.message || 'Coupon applied');
      return result;
    },
    [user, cart.subtotal, guestCart, settings, notify]
  );

  const removeCoupon = useCallback(async () => {
    setCoupon(null);
    write(KEYS.coupon, null);
    if (user) await refreshCart(undefined);
    notify('Coupon removed', 'info');
  }, [user, refreshCart, notify]);

  /* ------------------------------ wishlist ------------------------------ */
  const isWishlisted = useCallback(
    (productId) =>
      user ? wishlist.some((w) => w.product?.id === productId) : guestWish.some((w) => w.product_id === productId),
    [user, wishlist, guestWish]
  );

  const toggleWishlist = useCallback(
    async (product) => {
      const active = user
        ? wishlist.some((w) => w.product?.id === product.id)
        : guestWish.some((w) => w.product_id === product.id);
      if (user) {
        if (active) {
          await api.del(`/wishlist/${product.id}`);
          setWishlist((prev) => prev.filter((w) => w.product?.id !== product.id));
        } else {
          await api.post('/wishlist', { product_id: product.id });
          setWishlist((prev) => [...prev, { id: product.id, product }]);
        }
      } else {
        const next = active
          ? guestWish.filter((w) => w.product_id !== product.id)
          : [...guestWish, { product_id: product.id, product }];
        setGuestWish(next);
        write(KEYS.wish, next);
      }
      notify(active ? 'Removed from wishlist' : 'Saved to wishlist', active ? 'info' : 'success');
    },
    [user, wishlist, guestWish, notify]
  );

  const wishlistProducts = useMemo(
    () => (user ? wishlist.map((w) => w.product).filter(Boolean) : guestWish.map((w) => w.product).filter(Boolean)),
    [user, wishlist, guestWish]
  );

  /* --------------------------- recently viewed -------------------------- */
  const addRecent = useCallback(
    (product) => {
      if (!product?.slug) return;
      const snapshot = {
        id: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        price: product.price,
        mrp: product.mrp,
        images: product.images,
        rating: product.rating,
        review_count: product.review_count,
        category_name: product.category_name,
        stock: product.stock,
        sizes: product.sizes,
        colors: product.colors,
      };
      setRecent((prev) => {
        const next = [snapshot, ...prev.filter((p) => p.slug !== snapshot.slug)].slice(0, 12);
        write(KEYS.recent, next);
        return next;
      });
      api.post('/recently-viewed', { slug: product.slug }).catch(() => null);
    },
    []
  );

  const clearRecent = useCallback(() => {
    setRecent([]);
    write(KEYS.recent, []);
  }, []);

  /* ------------------------------ compare ------------------------------- */
  const toggleCompare = useCallback(
    (product) => {
      let message = '';
      setCompare((prev) => {
        const exists = prev.some((p) => p.id === product.id);
        if (exists) {
          message = 'Removed from comparison';
          const next = prev.filter((p) => p.id !== product.id);
          write(KEYS.compare, next);
          return next;
        }
        if (prev.length >= 4) {
          message = 'You can compare up to 4 products';
          return prev;
        }
        message = 'Added to comparison';
        const next = [...prev, product];
        write(KEYS.compare, next);
        return next;
      });
      if (message) notify(message, message.startsWith('You can') ? 'warn' : 'info');
    },
    [notify]
  );

  const clearCompare = useCallback(() => {
    setCompare([]);
    write(KEYS.compare, []);
  }, []);

  const value = useMemo(
    () => ({
      settings,
      brand: settings?.brand || {},
      commerce: settings?.commerce || {},
      payments: settings?.payments || {},
      faqs: settings?.faqs || [],
      siteCoupons: settings?.coupons || [],
      user,
      ready,
      isAdmin: user?.role === 'admin',
      cart,
      coupon,
      addToCart,
      updateQty,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
      refreshCart,
      wishlist: wishlistProducts,
      isWishlisted,
      toggleWishlist,
      refreshWishlist,
      theme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      lang,
      setLang,
      recent,
      addRecent,
      clearRecent,
      compare,
      toggleCompare,
      clearCompare,
      toasts,
      notify,
      dismissToast,
      login,
      register,
      logout,
      refreshUser,
    }),
    [
      settings, user, ready, cart, coupon, addToCart, updateQty, removeItem, clearCart, applyCoupon, removeCoupon,
      refreshCart, wishlistProducts, isWishlisted, toggleWishlist, refreshWishlist, theme, lang, recent, addRecent,
      clearRecent, compare, toggleCompare, clearCompare, toasts, notify, dismissToast, login, register, logout, refreshUser,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
