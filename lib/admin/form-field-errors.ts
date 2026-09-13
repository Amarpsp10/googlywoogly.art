import type { ZodError } from "zod";

/**
 * Convert a {@link ZodError} from a *nested* input schema into per-field errors
 * keyed by the flat `<form>` input `name` the admin editors actually render.
 *
 * Why this exists: `ZodError.flatten().fieldErrors` groups every issue by only
 * the FIRST segment of its path, so an error on a nested field such as
 * `defaultSeo.twitterHandle` lands under the key `"defaultSeo"` — a key no input
 * listens for via `useFieldError`. The editor then shows the generic
 * "please correct the highlighted fields" banner with nothing highlighted, which
 * is impossible to act on. This walks the individual issues instead and maps each
 * to the real input name so the offending field lights up.
 *
 * By default an issue maps to the LEAF segment of its path (e.g.
 * `socialLinks.pinterest` → `"pinterest"`), which is correct whenever the input
 * name equals the schema key. For inputs whose name differs from the schema key
 * (money entered in ₹, the announcement/address inputs), pass a `rename` map from
 * the full dotted path to the input name.
 */
export function zodErrorToFieldErrors(
  error: ZodError,
  rename: Record<string, string> = {},
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    if (issue.path.length === 0) continue; // form-level issue → leave to the banner
    const dotted = issue.path.join(".");
    const leaf = String(issue.path[issue.path.length - 1]);
    const name = rename[dotted] ?? leaf;
    if (!name) continue;
    (out[name] ??= []).push(issue.message);
  }
  return out;
}

/**
 * `SiteSetting` editor overrides: dotted schema paths whose form input name
 * differs from the schema leaf key. Money is entered in ₹ (schema stores paise),
 * the announcement inputs are prefixed, the social WhatsApp field is namespaced,
 * and the address lines are prefixed. Every other field maps by its leaf key.
 *
 * Keep in sync with the input `name`s in `app/admin/settings/settings-form.tsx`.
 */
export const SITE_SETTINGS_FIELD_RENAME: Record<string, string> = {
  "shippingDefaults.flatRatePaise": "flatRate",
  "shippingDefaults.freeShippingThresholdPaise": "freeShippingThreshold",
  "announcementBar.enabled": "announcementEnabled",
  "announcementBar.text": "announcementText",
  "announcementBar.href": "announcementHref",
  "socialLinks.whatsapp": "social_whatsapp",
  "businessAddress.line1": "addressLine1",
  "businessAddress.line2": "addressLine2",
};

/** Per-field errors for the `SiteSetting` editor, keyed by its form input names. */
export function siteSettingsFieldErrors(error: ZodError): Record<string, string[]> {
  return zodErrorToFieldErrors(error, SITE_SETTINGS_FIELD_RENAME);
}
