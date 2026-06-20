/**
 * Phone-format helpers for the admin CRM surfaces (PURE — no DB, no
 * `server-only`). Stored phone formats differ by source:
 *  - `Order.customerPhone` / `Customer.phone` are persisted **country-coded**
 *    (`91XXXXXXXXXX`, 12 digits) by `normalizeCustomerPhone` at placement.
 *  - `BulkInquiry.phone` / `ContactMessage.phone` are persisted as the **bare
 *    10-digit** national number by the lead `phoneSchema`.
 *
 * To build correct `wa.me` / `tel:` links and a clean display regardless of
 * source, normalise to a canonical 10-digit national number first, then format.
 * Indian mobiles are 10 digits with a leading 6–9; the country code is 91.
 */

/** Strip to the bare 10-digit national number (drops a leading 91/0 if present). */
function nationalDigits(phone: string): string {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/** `wa.me` digits — always country-coded (`91XXXXXXXXXX`). Empty if unusable. */
export function toWhatsAppDigits(phone: string): string {
  const national = nationalDigits(phone);
  return national.length === 10 ? `91${national}` : "";
}

/** `tel:` href — E.164 (`+91XXXXXXXXXX`). Falls back to the raw digits if odd. */
export function toTelHref(phone: string): string {
  const national = nationalDigits(phone);
  if (national.length === 10) return `tel:+91${national}`;
  const all = (phone ?? "").replace(/\D/g, "");
  return all ? `tel:+${all}` : "tel:";
}

/** Human display, e.g. `+91 98765 43210`. Falls back to the input when unusual. */
export function formatPhoneDisplay(phone: string): string {
  const national = nationalDigits(phone);
  if (national.length !== 10) return phone;
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}
