import { z } from "zod";
import { emailSchema, honeypotSchema } from "./common";

/**
 * Admin auth validation (doc 10 §6.1). Reuses the shared `emailSchema`
 * (trim + lowercase + format) and `honeypotSchema`. Kept minimal for MVP — the
 * full password-policy schema (reset/change flows, doc 10 FR-20) lands with
 * those surfaces.
 */
export const signInSchema = z.object({
  email: emailSchema,
  // Login does not enforce the password *policy* — it only needs a non-empty
  // value to compare; policy is enforced when *setting* a password.
  password: z.string().min(1, "Enter your password."),
  /** Honeypot — must be empty (doc 10 FR-15). */
  website: honeypotSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
