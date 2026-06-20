/**
 * Display formatting helpers. Timestamps are stored UTC and displayed in IST
 * (Asia/Kolkata) per CANON §10.
 */

const IST = "Asia/Kolkata";

export function formatDateIST(
  input: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  const d = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, ...options }).format(d);
}

export function formatDateTimeIST(input: Date | string | number): string {
  return formatDateIST(input, { dateStyle: "medium", timeStyle: "short" });
}

/** Compact relative-ish label for admin lists, e.g. "Today", "Yesterday". */
export function formatDayIST(input: Date | string | number): string {
  return formatDateIST(input, { day: "2-digit", month: "short", year: "numeric" });
}
