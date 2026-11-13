/**
 * ZYREX STORE — deterministic demo seed.
 *
 * Builds the complete initial dataset: departments, subcategories, ~169 products
 * with variants/specs/stock, reviews, coupons, blog & vlog posts, support FAQs,
 * an administrator account and a demo customer.
 *
 * All products are clearly demo records with demo prices. Product imagery is real
 * CC0 / public-domain photography bundled under public/catalogue (see
 * scripts/fetch-photos.mjs and public/catalogue/CREDITS.md); products without a
 * licensed photo fall back to original generated artwork from /api/img.
 */
import bcrypt from 'bcryptjs';
import { DEPARTMENTS, SPEC_TEMPLATES } from './catalogue-data.js';
import { PHOTOS } from './catalogue-photos.js';
import { newId } from './store.js';

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const pick = (arr, n) => arr[n % arr.length];
const round9 = (n) => {
  const v = Math.max(49, Math.round(n));
  return Math.max(49, Math.floor(v / 10) * 10 - 1);
};

const FOOTWEAR = /shoes|sandal|sneaker|footwear|helmet/i;
const CLOTHING = /t-shirt|shirt|jeans|trouser|shorts|hoodie|sweatshirt|jacket|blazer|kurta|kurti|saree|salwar|ethnic|dress|gown|skirt|leggings|top|sportswear|clothing|innerwear|jersey|bra/i;

const COLORS = {
  'fashion-clothing': ['Black', 'White', 'Navy', 'Olive', 'Maroon', 'Beige', 'Sky Blue'],
  electronics: ['Midnight Black', 'Silver', 'Space Blue', 'Graphite'],
  'home-kitchen': ['Steel Grey', 'Pearl White', 'Matte Black'],
  grocery: ['Standard Pack'],
  'beauty-personal-care': ['Default'],
  'sports-fitness': ['Black', 'Blue', 'Red'],
  'books-stationery': ['Default'],
  'toys-baby': ['Multicolour', 'Pastel'],
  automotive: ['Black', 'Grey'],
  'pet-supplies': ['Blue', 'Grey'],
};

const MATERIALS = {
  'fashion-clothing': ['100% Cotton', 'Cotton Blend', 'Denim', 'Viscose Rayon', 'Silk Blend', 'Polyester Blend'],
  electronics: ['Aluminium Alloy', 'ABS Polycarbonate'],
  'home-kitchen': ['Stainless Steel', 'ABS Plastic', 'Toughened Glass'],
  grocery: ['Food Grade Pack', 'Natural'],
  'beauty-personal-care': ['Cream', 'Gel', 'Serum', 'Liquid'],
  'sports-fitness': ['EVA Foam', 'Steel', 'Polyester'],
  'books-stationery': ['Paper', 'Card Stock'],
  'toys-baby': ['BPA-Free Plastic', 'Soft Plush', 'Wood'],
  automotive: ['ABS Plastic', 'Microfibre', 'Leatherette'],
  'pet-supplies': ['Food Grade', 'Nylon', 'Stainless Steel'],
};

const CAPACITY = ['250 ml', '500 ml', '1 L', '2 kg', '5 kg', '7 L', '1.5 Ton', '265 L'];
const POWER = ['750 W', '1200 W', '2000 W', '65 W', '20 W'];
const CONNECTIVITY = ['Bluetooth 5.3', 'Wi-Fi 6', 'USB-C', 'Dual SIM 5G', 'HDMI 2.1'];
const AGES = ['3+ years', '6+ years', '9+ years', '0-12 months'];
const PET_TYPES = ['Dog', 'Cat', 'All pets'];
const SHELF = ['6 months', '9 months', '12 months', '24 months'];

function buildProduct(dept, deptIndex, sub, noun, n) {
  const [baseName, mrp] = noun;
  const seed = hash(`${dept.slug}:${sub.name}:${baseName}:${n}`);
  const brand = pick(dept.brands, seed);
  const name = `${brand} ${baseName}`;
  const slug = `${slugify(baseName)}-${deptIndex}${n}${seed % 97}`;
  const discount = 18 + (seed % 38); // 18% – 55%
  const price = round9(mrp * (1 - discount / 100));
  const realDiscount = Math.round(((mrp - price) / mrp) * 100);
  const stockBase = seed % 100;
  const stock = stockBase < 6 ? 0 : stockBase < 14 ? 3 + (seed % 5) : 18 + (seed % 60);
  const rating = Number((3.6 + ((seed % 130) / 100)).toFixed(1));
  const reviewCount = 35 + (seed % 2400);
  const isFootwear = FOOTWEAR.test(sub.name);
  const isClothing = CLOTHING.test(sub.name) || (dept.slug === 'fashion-clothing' && !isFootwear && !/watch|bag|wallet|belt|sunglass|jewell|cap/i.test(sub.name));
  const sizes = isFootwear ? ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'] : isClothing ? ['XS', 'S', 'M', 'L', 'XL', 'XXL'] : [];
  const colors = COLORS[dept.slug] || ['Default'];
  const material = pick(MATERIALS[dept.slug] || ['Mixed'], seed);
  const capacity = pick(CAPACITY, seed);
  const specs = (SPEC_TEMPLATES[dept.slug] || (() => ({})))({
    material,
    fit: pick(['Regular Fit', 'Slim Fit', 'Relaxed Fit'], seed),
    pattern: pick(['Solid', 'Printed', 'Checked', 'Textured'], seed),
    sleeve: pick(['Half Sleeve', 'Full Sleeve', 'Sleeveless'], seed),
    connectivity: pick(CONNECTIVITY, seed),
    capacity,
    power: pick(POWER, seed),
    shelfLife: pick(SHELF, seed),
    age: pick(AGES, seed),
    petType: pick(PET_TYPES, seed),
  });

  // Real CC0 photography when available, generated artwork otherwise. The photo
  // map is keyed by catalogue noun; product names add a brand prefix.
  const photo = PHOTOS[noun] || PHOTOS[name];
  const images = photo
    ? [photo]
    : [0, 1, 2].map(
        (v) => `/api/img/product/${slug}.svg?v=${v}&glyph=${dept.glyph}&hue=${dept.hue}&label=${encodeURIComponent(brand)}`
      );

  const highlights = [
    `${sub.name} from the ${dept.name} collection`,
    `${material} build with premium finish`,
    `Backed by ${brand} quality checks`,
    sizes.length ? `Available in ${sizes.length} sizes and ${colors.length} colours` : `Ships in protective packaging`,
  ];

  return {
    id: newId(),
    slug,
    name,
    demo: true,
    brand,
    seller: `${brand} Official Store`,
    category_slug: dept.slug,
    category_name: dept.name,
    subcategory_slug: slugify(sub.name),
    subcategory_name: sub.name,
    group_name: sub.group,
    description: `${name} — a ${sub.name.toLowerCase()} pick from the ${dept.name} range at ZYREX STORE. Crafted with ${material.toLowerCase()} and finished to a premium standard, it is designed for everyday use with dependable ${dept.name.toLowerCase()} performance. Every unit is quality-checked before dispatch and covered by our easy return policy.`,
    highlights,
    mrp,
    price,
    discount_percent: realDiscount,
    stock,
    in_stock: stock > 0,
    sizes,
    colors,
    specs,
    images,
    rating,
    review_count: reviewCount,
    rating_breakdown: {
      5: Math.round(reviewCount * 0.62),
      4: Math.round(reviewCount * 0.21),
      3: Math.round(reviewCount * 0.1),
      2: Math.round(reviewCount * 0.04),
      1: Math.round(reviewCount * 0.03),
    },
    delivery_days: 2 + (seed % 5),
    return_days: dept.slug === 'grocery' || dept.slug === 'beauty-personal-care' ? 7 : 10,
    returnable: true,
    featured: seed % 7 === 0,
    bestseller: seed % 5 === 0,
    new_arrival: seed % 4 === 0,
    tags: [sub.name.toLowerCase(), sub.group.toLowerCase(), dept.name.toLowerCase(), brand.toLowerCase()],
    warranty: dept.slug === 'electronics' || dept.slug === 'home-kitchen' ? '1 year manufacturer warranty' : 'Seller warranty',
    sold_count: 40 + (seed % 1800),
    created_at: new Date(Date.now() - (seed % 90) * 86400000).toISOString(),
  };
}

const REVIEW_NAMES = ['Aarav S.', 'Priya M.', 'Rohit K.', 'Sneha D.', 'Imran H.', 'Nisha R.', 'Vikram T.', 'Ananya G.', 'Sourav B.', 'Meera J.'];
const REVIEW_TEXT = [
  'Exactly as described. Packaging was neat and delivery was quicker than expected.',
  'Good quality for the price. Would recommend to friends and family.',
  'Works well and looks premium. Happy with this purchase from ZYREX.',
  'Value for money. The finish and material feel better than similar products I owned.',
  'Solid buy. Support team answered my query quickly and the return process was simple.',
];

const BLOG = [
  {
    title: 'Festive Wardrobe Guide: Building a Complete Ethnic Look',
    category: 'Fashion',
    excerpt: 'Layer colours, fabrics and accessories the right way for Durga Puja and Diwali gatherings without overspending.',
    body: [
      'Festive dressing is about balance: one statement piece, complementary colours and comfortable fabrics that survive a long day of visiting family and friends.',
      'Start with a base in a neutral tone, then add a woven or embroidered layer. Silk blends photograph beautifully under warm lighting, while cotton-silk keeps you comfortable through the evening.',
      'Accessories should echo the metal tone of your outfit. Oxidised silver works with cool colours, while antique gold lifts maroons and deep greens.',
      'Finally, plan footwear in advance. A block heel or a well-cushioned flat will carry you through the longest celebration.',
    ],
  },
  {
    title: 'How to Choose the Right Smartphone in 2026',
    category: 'Electronics',
    excerpt: 'Refresh rate, battery, camera sensors and update support matter far more than the megapixel number on the box.',
    body: [
      'A phone is a three-year purchase, so start with software support. Check how many OS updates the brand promises before you look at the camera.',
      'Battery capacity in mAh matters less than charging speed and efficiency. A 5000mAh cell with a 65W charger will outperform a bigger battery with slow charging.',
      'For photography, sensor size and processing beat megapixel counts. Look for a larger primary sensor and optical stabilisation.',
      'Try the phone in your hand if possible. Weight and grip decide whether you enjoy using a device every day.',
    ],
  },
  {
    title: 'Small Kitchen, Smart Storage: A Practical Checklist',
    category: 'Home & Kitchen',
    excerpt: 'Stackable organisers, modular racks and a little planning can double usable kitchen space.',
    body: [
      'Measure before you buy. Vertical space above the counter is usually the most underused area in an Indian kitchen.',
      'Group by frequency: daily items at arm level, occasional appliances on high shelves, bulk staples in airtight containers below.',
      'Choose stainless steel and food-grade plastic for longevity, and keep spices away from direct heat and light.',
      'A modular tool organiser and a stackable rack together free up nearly a metre of counter space.',
    ],
  },
  {
    title: 'Grocery Shopping Online: Save Money Without Compromising',
    category: 'Grocery',
    excerpt: 'Compare unit prices, buy staples in the right pack size and use coupons only on things you actually need.',
    body: [
      'Unit price is the real comparison. A 5kg pack is often cheaper per kilo, but only if you will finish it before it spoils.',
      'Stack a category offer with a coupon only when the item is on your list — discounts on impulse purchases are not savings.',
      'Check the net quantity on packaged foods. Package redesigns sometimes reduce weight without changing the price.',
      'Keep a running list and buy fresh produce twice a month rather than weekly to reduce waste.',
    ],
  },
  {
    title: 'Skincare Layering: The Order That Actually Works',
    category: 'Beauty',
    excerpt: 'Cleanse, treat, moisturise, protect. A simple four-step routine beats a shelf full of half-used bottles.',
    body: [
      'Apply products from the thinnest to the thickest consistency so each layer can absorb.',
      'Introduce one active ingredient at a time and give it three weeks before judging results.',
      'Sunscreen is the step that protects every other gain, so make it the last step every morning.',
      'If your skin stings or flakes, stop the newest product first and simplify the routine.',
    ],
  },
  {
    title: 'Beginner Home Gym Setup Under ₹10,000',
    category: 'Sports',
    excerpt: 'A mat, resistance bands and one adjustable weight cover almost every beginner programme.',
    body: [
      'You do not need a rack to start. Bodyweight progressions plus resistance build real strength in the first six months.',
      'Buy an anti-slip mat first — it protects your floor and makes floor work comfortable.',
      'Resistance bands are the cheapest way to add progressive load for pull patterns.',
      'Add adjustable dumbbells once bodyweight movements feel easy, not before.',
    ],
  },
  {
    title: 'Monsoon Electronics Care: Five Habits That Prevent Damage',
    category: 'Technology',
    excerpt: 'Humidity is harder on electronics than heat. Here is how to protect laptops, phones and appliances.',
    body: [
      'Use silica gel packs in camera bags and laptop sleeves, and replace them each season.',
      'Never charge a phone that has picked up moisture — dry the port first with the device powered off.',
      'Run your air conditioner in dry mode for twenty minutes a day to pull moisture out of a room.',
      'Keep appliances on a stabiliser and unplug during voltage fluctuations.',
    ],
  },
  {
    title: 'Return and Refund Rights Every Online Shopper Should Know',
    category: 'Shopping Tips',
    excerpt: 'Understand return windows, packaging requirements and how refunds are credited.',
    body: [
      'A return window starts from delivery, not from the order date, so check it before you discard packaging.',
      'Keep original tags and boxes for apparel and electronics — most rejections come from missing packaging.',
      'Refunds to the original payment method take longer than store credit; both are tracked in your order timeline.',
      'Raise a return request from My Orders within the window, and photograph any damage before opening a ticket.',
    ],
  },
];

const VLOG = [
  { title: 'Unboxing the Zyrex Tech Nova X9 5G', description: 'A full unboxing and first-impressions walkthrough of our best-selling 5G smartphone.', search: 'smartphone unboxing 2026', duration: '8:24' },
  { title: 'Festive Ethnic Wear Try-On Haul', description: 'Six festive looks styled from the ZYREX fashion collection with fit notes for each.', search: 'ethnic wear haul styling', duration: '12:05' },
  { title: 'Kitchen Appliance Demo: Air Fryer Basics', description: 'Three beginner recipes and a comparison of cooking times in a 5.5L digital air fryer.', search: 'air fryer beginner recipes', duration: '9:41' },
  { title: 'Grocery Staples: What to Buy and What to Skip', description: 'Our buying team explains pack sizes, storage and how to read unit pricing.', search: 'grocery shopping guide india', duration: '6:18' },
  { title: 'Building a Home Gym Step by Step', description: 'A budget-friendly equipment walkthrough with three starter workouts.', search: 'home gym setup beginner', duration: '10:52' },
];

const FAQS = [
  { q: 'How long does delivery take?', a: 'Most orders are delivered in 2–6 working days depending on your PIN code. The estimated date is shown on every product page and in checkout.' },
  { q: 'Is Cash on Delivery available?', a: 'COD is available on eligible PIN codes and orders under the COD limit. It can be disabled by the store administrator at any time.' },
  { q: 'How do I return a product?', a: 'Open My Orders, choose the delivered order and select Return within the return window shown on the product. Keep the original packaging and tags.' },
  { q: 'When will I get my refund?', a: 'Once the return is picked up and verified, refunds are initiated within 48 hours. Card and UPI refunds usually reflect in 3–7 working days.' },
  { q: 'Are the products original?', a: 'Every listing is fulfilled by the seller named on the product page. This demonstration catalogue uses sample products until live inventory is supplied.' },
  { q: 'Can I change my delivery address after ordering?', a: 'Address changes are possible before the order is packed. Contact support with your order number and we will help if the shipment has not been dispatched.' },
  { q: 'Do you charge for shipping?', a: 'Shipping is free above the threshold shown in your cart; a flat fee applies to smaller orders.' },
  { q: 'How do I apply a coupon?', a: 'Enter the code in the cart or checkout summary and apply it. The discount is validated on the server before your order is created.' },
];

export function seedDatabase(db) {
  const now = new Date().toISOString();
  const categories = [];
  const subcategories = [];
  const products = [];
  const reviews = [];

  DEPARTMENTS.forEach((dept, di) => {
    categories.push({
      id: newId(),
      slug: dept.slug,
      name: dept.name,
      tagline: dept.tagline,
      glyph: dept.glyph,
      hue: dept.hue,
      banner: `/api/img/banner/${dept.slug}.svg?glyph=${dept.glyph}&hue=${dept.hue}&label=${encodeURIComponent(dept.name)}&w=1600&h=560`,
      icon: `/api/img/product/${dept.slug}-icon.svg?v=3&glyph=${dept.glyph}&hue=${dept.hue}`,
      position: di,
      groups: [...new Set(dept.subs.map((s) => s.group))],
      created_at: now,
    });

    dept.subs.forEach((sub, si) => {
      const subSlug = slugify(sub.name);
      subcategories.push({
        id: newId(),
        category_slug: dept.slug,
        slug: subSlug,
        name: sub.name,
        group_name: sub.group,
        position: si,
        created_at: now,
      });
      sub.nouns.forEach((noun, ni) => {
        const product = buildProduct(dept, di, sub, noun, si * 10 + ni);
        products.push(product);
        if (hash(product.slug) % 3 === 0) {
          for (let r = 0; r < 2; r += 1) {
            const rs = hash(`${product.slug}:r${r}`);
            reviews.push({
              id: newId(),
              product_id: product.id,
              product_slug: product.slug,
              user_id: null,
              author: REVIEW_NAMES[rs % REVIEW_NAMES.length],
              rating: 5 - (rs % 2),
              title: rs % 2 ? 'Great value' : 'Really happy with it',
              body: REVIEW_TEXT[rs % REVIEW_TEXT.length],
              verified: true,
              created_at: new Date(Date.now() - (rs % 60) * 86400000).toISOString(),
            });
          }
        }
      });
    });
  });

  const coupons = [
    { code: 'WELCOME10', description: '10% off your first order above ₹999 (max ₹200 off)', type: 'percent', value: 10, min_order: 999, max_discount: 200, campaign: 'New User Offer', active: true },
    { code: 'NEWUSER15', description: '15% off for new customers above ₹1,499 (max ₹400 off)', type: 'percent', value: 15, min_order: 1499, max_discount: 400, campaign: 'First Order Coupon', active: true },
    { code: 'FESTIVE500', description: 'Flat ₹500 off on orders above ₹2,999', type: 'flat', value: 500, min_order: 2999, max_discount: 500, campaign: 'Festival Discount', active: true },
    { code: 'DIWALI26', description: '25% Diwali Sale discount above ₹1,999 (max ₹1,500 off)', type: 'percent', value: 25, min_order: 1999, max_discount: 1500, campaign: 'Diwali Sale', active: true },
    { code: 'DURGA20', description: '20% Durga Puja Sale discount above ₹1,499 (max ₹1,000 off)', type: 'percent', value: 20, min_order: 1499, max_discount: 1000, campaign: 'Durga Puja Sale', active: true },
    { code: 'SUMMER20', description: '20% Summer Sale discount above ₹1,299', type: 'percent', value: 20, min_order: 1299, max_discount: 900, campaign: 'Summer Sale', active: true },
    { code: 'MONSOON15', description: '15% Monsoon Sale discount above ₹999', type: 'percent', value: 15, min_order: 999, max_discount: 700, campaign: 'Monsoon Sale', active: true },
    { code: 'INDEP26', description: '26% Independence Day Sale discount above ₹1,999', type: 'percent', value: 26, min_order: 1999, max_discount: 1300, campaign: 'Independence Day Sale', active: true },
    { code: 'REPUBLIC26', description: '26% Republic Day Sale discount above ₹1,999', type: 'percent', value: 26, min_order: 1999, max_discount: 1300, campaign: 'Republic Day Sale', active: true },
    { code: 'XMAS20', description: '20% Christmas Sale discount above ₹1,499', type: 'percent', value: 20, min_order: 1499, max_discount: 1000, campaign: 'Christmas Sale', active: true },
    { code: 'NEWYEAR25', description: '25% New Year Sale discount above ₹1,999', type: 'percent', value: 25, min_order: 1999, max_discount: 1200, campaign: 'New Year Sale', active: true },
    { code: 'FLASH10', description: 'Flash Sale: extra 10% off above ₹799', type: 'percent', value: 10, min_order: 799, max_discount: 500, campaign: 'Flash Sale', active: true },
    { code: 'FREESHIP', description: 'Free delivery on any order', type: 'shipping', value: 0, min_order: 0, max_discount: 0, campaign: 'Free Delivery Offer', active: true },
  ].map((c) => ({
    ...c,
    id: newId(),
    usage_limit: 100000,
    used_count: 0,
    starts_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
    created_at: now,
  }));

  const blog_posts = BLOG.map((post, i) => {
    const rs = hash(post.title);
    return {
      id: newId(),
      slug: slugify(post.title),
      title: post.title,
      category: post.category,
      excerpt: post.excerpt,
      body: post.body.join('\n\n'),
      author: REVIEW_NAMES[rs % REVIEW_NAMES.length].replace('.', ''),
      read_minutes: 3 + (rs % 5),
      cover: `/api/img/blog/${slugify(post.title)}.svg?glyph=book&hue=${(rs % 300) + 20}&label=${encodeURIComponent(post.category)}&w=1200&h=700`,
      published: true,
      published_at: new Date(Date.now() - i * 4 * 86400000).toISOString(),
      created_at: now,
    };
  });

  const vlog_posts = VLOG.map((v, i) => {
    const rs = hash(v.title);
    return {
      id: newId(),
      slug: slugify(v.title),
      title: v.title,
      description: v.description,
      duration: v.duration,
      youtube_id: '',
      youtube_search: v.search,
      cover: `/api/img/vlog/${slugify(v.title)}.svg?glyph=chip&hue=${(rs % 260) + 40}&label=${encodeURIComponent('VLOG')}&w=1200&h=700`,
      published: true,
      published_at: new Date(Date.now() - i * 6 * 86400000).toISOString(),
      created_at: now,
    };
  });

  const adminHash = bcrypt.hashSync('Admin@12345', 10);
  const customerHash = bcrypt.hashSync('Customer@12345', 10);

  const users = [
    {
      id: newId(),
      name: 'ZYREX Administrator',
      email: 'admin@zyrexstore.com',
      password_hash: adminHash,
      role: 'admin',
      phone: '+91 90000 00001',
      email_verified: true,
      created_at: now,
    },
    {
      id: newId(),
      name: 'Demo Customer',
      email: 'customer@zyrexstore.com',
      password_hash: customerHash,
      role: 'customer',
      phone: '+91 90000 00002',
      email_verified: true,
      created_at: now,
    },
  ];

  const settings = {
    brand: {
      name: 'ZYREX STORE',
      tagline: 'Everything you need, in one premium marketplace',
      announcement: 'Festive Sale is live — up to 55% off across fashion, electronics and home. Use code DIWALI26.',
      support_email: 'support@zyrexstore.com',
      support_phone: '+91 90000 00000',
      support_hours: 'Mon–Sat, 9:00 AM – 8:00 PM IST',
      address: 'ZYREX Retail Pvt. Ltd., Sector V, Salt Lake, Kolkata, West Bengal 700091, India',
      gstin: 'DEMO-GSTIN-PENDING',
      social: {
        instagram: 'https://instagram.com/',
        facebook: 'https://facebook.com/',
        youtube: 'https://youtube.com/',
        x: 'https://x.com/',
      },
    },
    commerce: {
      currency: 'INR',
      cod_enabled: String(process.env.ENABLE_COD || 'true') === 'true',
      shipping_fee: Number(process.env.SHIPPING_FLAT_FEE || 49),
      free_shipping_threshold: Number(process.env.FREE_SHIPPING_THRESHOLD || 999),
      cod_limit: 25000,
      locale: 'en-IN',
      languages: ['en', 'bn'],
    },
    payments: {
      provider: 'razorpay',
      mode: 'test',
      enabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    },
  };

  return {
    users,
    addresses: [],
    categories,
    subcategories,
    products,
    reviews,
    cart_items: [],
    wishlist_items: [],
    orders: [],
    coupons,
    coupon_usage: [],
    blog_posts,
    vlog_posts,
    newsletter: [],
    tickets: [],
    recently_viewed: [],
    settings: [
      { id: newId(), key: 'brand', value: settings.brand, created_at: now },
      { id: newId(), key: 'commerce', value: settings.commerce, created_at: now },
      { id: newId(), key: 'payments', value: settings.payments, created_at: now },
      { id: newId(), key: 'faqs', value: FAQS, created_at: now },
    ],
  };
}
