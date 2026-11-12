/**
 * One canonical address shape for the whole application.
 *
 * The storefront checkout form, the account address book and the order API all
 * need to agree. Earlier the address book stored `name`/`line1` while the order
 * API required `full_name`/`address_line1`, which rejected every checkout.
 * Normalising here (accepting both spellings) keeps old stored rows working and
 * means a saved address can always be used to place an order.
 *
 * Canonical keys: full_name, phone, email, line1, line2, landmark, city, state,
 * pincode, instructions, label. `name` and `address_line1` are mirrored for
 * backwards compatibility with existing records and UI.
 */
export const ADDRESS_FIELDS = [
  'full_name',
  'phone',
  'email',
  'line1',
  'line2',
  'landmark',
  'city',
  'state',
  'pincode',
  'instructions',
  'label',
];

/** Accepted aliases per canonical field, in priority order. */
const ALIASES = {
  full_name: ['full_name', 'name', 'recipient', 'recipient_name'],
  phone: ['phone', 'mobile', 'mobile_number'],
  email: ['email'],
  line1: ['line1', 'address_line1', 'address', 'address1'],
  line2: ['line2', 'address_line2', 'address2'],
  landmark: ['landmark'],
  city: ['city', 'town'],
  state: ['state'],
  pincode: ['pincode', 'pin', 'pin_code', 'postal_code', 'zip'],
  instructions: ['instructions', 'delivery_instructions', 'notes'],
  label: ['label'],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Map any accepted spelling onto the canonical address shape. */
export function normalizeAddress(input = {}) {
  const source = input || {};
  const out = {};
  for (const [field, keys] of Object.entries(ALIASES)) {
    out[field] = '';
    for (const key of keys) {
      const value = String(source[key] ?? '').trim();
      if (value) {
        out[field] = value;
        break;
      }
    }
  }
  // Mirrored legacy keys so older rows and components keep rendering.
  out.name = out.full_name;
  out.address_line1 = out.line1;
  return out;
}

/**
 * Validate a delivery address. Email is optional for the address book but
 * required to place an order (it is used for the confirmation).
 */
export function validateAddress(input, { requireEmail = false } = {}) {
  const a = normalizeAddress(input);
  if (a.full_name.length < 2) return 'Please enter the recipient name.';

  const digits = a.phone.replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(digits)) return 'Please enter a valid 10-digit Indian mobile number.';

  if (a.line1.length < 6) return 'Please enter the delivery address.';
  if (!a.city) return 'Please enter your city.';
  if (!a.state) return 'Please enter your state.';
  if (!/^[1-9]\d{5}$/.test(a.pincode)) return 'Please enter a valid 6-digit PIN code.';

  if (requireEmail && !a.email) return 'Email is required.';
  if (a.email && !EMAIL_RE.test(a.email)) return 'Enter a valid email address.';

  return null;
}
