/**
 * Money utilities. The DB stores all monetary values as integer **paise**
 * (₹1 = 100 paise) to avoid floating-point drift. Display formatting is
 * presentational only and uses the `en-IN` locale with the ₹ symbol.
 */

export const PAISE_PER_RUPEE = 100;

/** Convert a rupee amount (possibly fractional) to integer paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/** Convert integer paise to a rupee number (may be fractional). */
export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

type DecimalMode = "auto" | "always" | "never";

/**
 * Format integer paise as an `en-IN` INR currency string, e.g. `₹1,299`.
 * - `auto` (default): show paise only when the amount is not a whole rupee.
 * - `always`: always show two decimals (`₹1,299.00`).
 * - `never`: never show decimals.
 */
export function formatPaise(
  paise: number,
  options: { showDecimals?: DecimalMode } = {},
): string {
  const { showDecimals = "auto" } = options;
  const rupees = paise / PAISE_PER_RUPEE;
  const hasFraction = paise % PAISE_PER_RUPEE !== 0;
  const showFraction =
    showDecimals === "always" || (showDecimals === "auto" && hasFraction);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: showFraction ? 2 : 0,
    maximumFractionDigits: showFraction ? 2 : 0,
  }).format(rupees);
}

/** Percentage saved when a compareAtPrice is present (0 when not applicable). */
export function discountPercent(
  price: number,
  compareAtPrice: number | null | undefined,
): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}
