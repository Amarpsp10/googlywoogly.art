import { z } from "zod";
import { INDIAN_STATES } from "@/lib/constants";

/**
 * Shared Zod primitives reused across checkout, leads, and admin forms so that
 * phone/pincode/address validation is defined once.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.");

/**
 * Indian mobile number. Accepts +91 / 91 / 0 prefixes and spaces/dashes,
 * normalizes to a bare 10-digit number starting 6–9.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => {
    let d = v.replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
    else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    return d;
  })
  .pipe(
    z
      .string()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  );

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode.");

export const indianStateSchema = z.enum(
  INDIAN_STATES as unknown as [string, ...string[]],
  { errorMap: () => ({ message: "Select a valid state." }) },
);

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  phone: phoneSchema,
  line1: z.string().trim().min(3, "Address line 1 is required."),
  line2: z.string().trim().optional(),
  landmark: z.string().trim().optional(),
  city: z.string().trim().min(2, "City is required."),
  state: indianStateSchema,
  pincode: pincodeSchema,
  country: z.literal("IN").default("IN"),
});

export type AddressInput = z.infer<typeof addressSchema>;

/** Anti-spam honeypot: must be empty if present. */
export const honeypotSchema = z.string().max(0).optional();
