/**
 * ZYREX STORE — generated demo artwork service.
 *
 * No image-generation service is connected, so the catalogue ships with original
 * vector artwork generated on the server from the product identity (department
 * glyph + deterministic palette). Nothing is copied from a third party, every URL
 * resolves locally and each product gets a distinct composition. Administrators
 * can replace any product image with a real photograph by setting image URLs in
 * the dashboard; the storefront prefers those when present.
 */

const GLYPHS = {
  shirt:
    '<path d="M60 38 84 26h32l24 12 20 26-22 14-10-12v70a6 6 0 0 1-6 6H78a6 6 0 0 1-6-6V66L62 78 40 64Z"/>',
  chip:
    '<rect x="58" y="58" width="84" height="84" rx="14"/><rect x="86" y="86" width="28" height="28" rx="6" opacity=".55"/><path d="M78 40v18M100 40v18M122 40v18M78 142v18M100 142v18M122 142v18M40 78h18M40 100h18M40 122h18M142 78h18M142 100h18M142 122h18" stroke-width="8" stroke-linecap="round"/>',
  home:
    '<path d="M100 34 42 82h16v68h84V82h16Z"/><rect x="86" y="106" width="28" height="44" rx="4" opacity=".5"/>',
  basket:
    '<path d="M44 78h112l-12 74a10 10 0 0 1-10 8H66a10 10 0 0 1-10-8Z"/><path d="M74 78 92 42M126 78 108 42" stroke-width="9" stroke-linecap="round"/><path d="M82 96v46M100 96v46M118 96v46" stroke-width="6" opacity=".45" stroke-linecap="round"/>',
  droplet:
    '<path d="M100 30s52 54 52 88a52 52 0 0 1-104 0c0-34 52-88 52-88Z"/><path d="M78 116a24 24 0 0 0 24 24" stroke-width="8" opacity=".5" stroke-linecap="round"/>',
  dumbbell:
    '<rect x="30" y="86" width="140" height="28" rx="14"/><rect x="20" y="66" width="26" height="68" rx="10"/><rect x="154" y="66" width="26" height="68" rx="10"/><rect x="54" y="74" width="18" height="52" rx="8" opacity=".6"/><rect x="128" y="74" width="18" height="52" rx="8" opacity=".6"/>',
  book:
    '<path d="M40 44h56a16 16 0 0 1 16 16v104a14 14 0 0 0-14-14H40Z"/><path d="M160 44h-56a16 16 0 0 0-16 16v104a14 14 0 0 1 14-14h58Z" opacity=".62"/>',
  blocks:
    '<rect x="38" y="96" width="60" height="60" rx="10"/><rect x="104" y="96" width="60" height="60" rx="10" opacity=".7"/><rect x="70" y="36" width="60" height="52" rx="10" opacity=".85"/><circle cx="68" cy="86" r="7" opacity=".55"/><circle cx="134" cy="86" r="7" opacity=".55"/>',
  car:
    '<path d="M34 120h132l-10-30a20 20 0 0 0-19-14H63a20 20 0 0 0-19 14Z"/><rect x="30" y="118" width="140" height="26" rx="12" opacity=".75"/><circle cx="66" cy="150" r="14"/><circle cx="134" cy="150" r="14"/>',
  paw:
    '<ellipse cx="100" cy="128" rx="34" ry="28"/><circle cx="60" cy="92" r="16"/><circle cx="86" cy="70" r="16"/><circle cx="116" cy="70" r="16"/><circle cx="142" cy="92" r="16"/>',
  default:
    '<circle cx="100" cy="100" r="56"/><circle cx="100" cy="100" r="30" opacity=".5"/>',
};

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

/**
 * Build an SVG string for a product/banner.
 * @param {object} opts
 * @param {string} opts.seed   unique seed (product slug)
 * @param {string} opts.glyph  department glyph key
 * @param {number} opts.hue    base hue
 * @param {string} opts.label  short label rendered on the artwork
 * @param {number} opts.variant 0..3 composition variant
 */
export function renderArtwork({ seed = 'zyrex', glyph = 'default', hue = 250, label = '', variant = 0, width = 800, height = 800 }) {
  const h = hash(`${seed}:${variant}`);
  const h1 = (Number(hue) + (h % 24) - 12 + 360) % 360;
  const h2 = (h1 + 38 + (h % 30)) % 360;
  const angle = 20 + (h % 5) * 18;
  const shape = GLYPHS[glyph] || GLYPHS.default;
  const scale = variant === 0 ? 1 : variant === 1 ? 0.82 : 0.68;
  const rotate = variant === 2 ? -8 : 0;
  const tx = width / 2 - 100;
  const ty = height / 2 - 100 - (label ? 18 : 0);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">
  <defs>
    <linearGradient id="bg" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="hsl(${h1} 72% 58%)"/>
      <stop offset="55%" stop-color="hsl(${h2} 68% 46%)"/>
      <stop offset="100%" stop-color="hsl(${(h2 + 26) % 360} 62% 32%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="22%" r="70%">
      <stop offset="0%" stop-color="#fff" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
      <circle cx="2" cy="2" r="1.6" fill="#fff" opacity=".16"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#dots)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <g transform="translate(${tx} ${ty}) scale(${scale}) rotate(${rotate} 100 100)" fill="#ffffff" fill-opacity=".92" stroke="none">
    ${shape}
  </g>
  <g transform="translate(0 ${height - 96})">
    <rect x="0" y="0" width="${width}" height="96" fill="#0b1224" fill-opacity=".22"/>
    <text x="40" y="56" font-family="Plus Jakarta Sans, Inter, system-ui, sans-serif" font-size="30" font-weight="700" fill="#fff" fill-opacity=".96">${escapeXml(label.slice(0, 30))}</text>
  </g>
</svg>`;
}

export function artworkRoute(req, res) {
  const kind = String(req.params.kind || 'product').toLowerCase();
  const seed = String(req.params.seed || 'zyrex');
  const glyph = String(req.query.glyph || 'default');
  const hue = Number(req.query.hue || 250);
  const variant = Math.max(0, Math.min(3, Number(req.query.v || 0)));
  const label = String(req.query.label || '');
  const width = Math.max(120, Math.min(1600, Number(req.query.w || (kind === 'banner' ? 1600 : 800))));
  const height = Math.max(120, Math.min(1600, Number(req.query.h || (kind === 'banner' ? 560 : 800))));
  const svg = renderArtwork({ seed, glyph, hue, label, variant, width, height });
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  res.send(svg);
}
