/** Typed-ish fetch helpers for the ZYREX API. */
// The client can be hosted separately from the API (for example on GitHub Pages),
// so the API origin is configurable at build time. Same-origin is the default.
const API_ORIGIN = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
const BASE = `${API_ORIGIN}/api`;

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const opts = { method, credentials: 'include', headers: { ...headers } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.code = data?.code;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ?? {} }),
  del: (path, body) => request(path, { method: 'DELETE', body }),
  upload: async (file) => {
    const res = await fetch(`${BASE}/admin/uploads`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    return data;
  },
};

/** Build a query string from a filter object, dropping empty values. */
export function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

/** Resolve an API image path against the API origin (or the current origin). */
export const imageUrl = (src) => {
  if (!src) return imageUrl('/api/img/product/zyrex.svg?glyph=box&label=ZYREX&hue=250');
  if (src.startsWith('http') || src.startsWith('data:')) return src;
  if (src.startsWith('/api/')) return `${API_ORIGIN}${src}`;
  return src;
};
