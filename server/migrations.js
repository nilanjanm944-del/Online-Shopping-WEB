/**
 * One-time data migrations applied on boot.
 *
 * The deployed store keeps its records in a persisted JSON file, so renaming a
 * seeded value in code is not enough — existing installs must be updated in
 * place. Every step here is idempotent, so repeated boots are safe.
 */
import { find, update, persist } from './store.js';

export function runMigrations() {
  try {
    // Coupon rename: DIWALI25 → DIWALI26 (festive campaign code).
    const legacy = find('coupons', (c) => String(c.code || '').toUpperCase() === 'DIWALI25');
    if (legacy) {
      update('coupons', legacy.id, { code: 'DIWALI26' });
      console.log('[migrations] renamed coupon DIWALI25 → DIWALI26');
    }

    // Keep the storefront announcement in step with the new code.
    const settings = find('settings', () => true);
    if (settings?.id && typeof settings.announcement === 'string' && settings.announcement.includes('DIWALI25')) {
      update('settings', settings.id, { announcement: settings.announcement.replaceAll('DIWALI25', 'DIWALI26') });
    }

    persist();
  } catch (err) {
    // A migration must never stop the server from booting.
    console.error('[migrations] skipped:', err.message);
  }
}
