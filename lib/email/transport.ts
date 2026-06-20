import "server-only";

import { prisma } from "@/lib/db";

/**
 * Provider-agnostic email transport (docs/14 §3.2 FR-6/FR-8, §5.2).
 *
 * - If `RESEND_API_KEY` is set, sends via the **Resend REST API** with `fetch`
 *   (no SDK, no new deps — CANON §16.8). From = `EMAIL_FROM`.
 * - Otherwise (local/dev), logs a one-line summary to the console and resolves
 *   as a successful "dev-console" send so the rest of the flow works offline.
 *
 * Every attempt writes exactly one `NotificationLog` row (FR-3): channel
 * `email`, the `template` key, recipient `to`, `subject`, `status`
 * (`sent`/`failed`), the provider message id, and any error. This function
 * **never throws** to the caller — a provider/DB failure resolves to
 * `{ ok: false }` so notifications never block the order (FR-4 / `08` FR-37).
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
/** Hard ceiling on the network call so a hung provider can't stall placement. */
const SEND_TIMEOUT_MS = 8000;
/** Trim long provider/exception text before persisting (PII-light, no secrets). */
const MAX_ERROR_LEN = 500;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** `Reply-To` — typically the founder's real inbox (`SiteSetting.contactEmail`). */
  replyTo?: string;
  /** Template key for the `NotificationLog` row (defaults to "custom"). */
  template?: string;
  /** Optional order linkage for the `NotificationLog` row + admin history. */
  orderId?: string;
}

export interface SendEmailResult {
  /** Provider message id, or `"dev-console"` / `""` when not sent by a provider. */
  id: string;
  ok: boolean;
}

/** Truncate + strip control noise from error text we persist. */
function safeError(message: unknown): string {
  const text =
    message instanceof Error ? message.message : typeof message === "string" ? message : String(message);
  return text.slice(0, MAX_ERROR_LEN);
}

/**
 * Best-effort write of a `NotificationLog` row. Swallows its own errors — a
 * logging failure must never turn a successful (or failed) send into a throw.
 */
async function writeLog(args: {
  to: string;
  subject: string;
  template: string;
  status: "sent" | "failed";
  providerMessageId?: string | null;
  error?: string | null;
  orderId?: string;
}): Promise<void> {
  try {
    await prisma.notificationLog.create({
      data: {
        channel: "email",
        template: args.template,
        to: args.to,
        subject: args.subject,
        status: args.status,
        providerMessageId: args.providerMessageId ?? null,
        error: args.error ?? null,
        orderId: args.orderId ?? null,
      },
    });
  } catch (err) {
    // Logging is best-effort; surface for observability but do not rethrow.
    console.error("[email] failed to write NotificationLog:", safeError(err));
  }
}

/** POST the email to Resend with a timeout; returns the provider message id. */
async function sendViaResend(
  apiKey: string,
  from: string,
  input: SendEmailInput,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Resend returns a JSON error body; capture its message when present.
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string; name?: string };
        if (body?.message) detail = `${body.name ? `${body.name}: ` : ""}${body.message}`;
      } catch {
        // non-JSON body — keep the status code
      }
      throw new Error(detail);
    }

    const body = (await res.json()) as { id?: string };
    return body?.id ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send a transactional email and log the attempt. Resolves `{ ok:false }` on any
 * failure (never throws). When no provider is configured, logs to the console and
 * resolves `{ id:"dev-console", ok:true }`.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const template = input.template ?? "custom";
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "GooglyWoogly Art <orders@googlywoogly.art>";

  // Guard an empty/garbage recipient before we attempt a send (FR-34 `skipped`
  // semantics are handled by callers; here we hard-fail an obviously invalid to).
  const to = input.to?.trim();
  if (!to) {
    await writeLog({
      to: input.to ?? "",
      subject: input.subject,
      template,
      status: "failed",
      error: "missing recipient",
      orderId: input.orderId,
    });
    return { id: "", ok: false };
  }

  // ── Dev / no-provider path: console fallback ──
  if (!apiKey) {
    console.log(
      `[email:dev] → ${to} · "${input.subject}" · template=${template}${
        input.orderId ? ` · order=${input.orderId}` : ""
      } (no RESEND_API_KEY; not sent)`,
    );
    await writeLog({
      to,
      subject: input.subject,
      template,
      status: "sent",
      providerMessageId: "dev-console",
      orderId: input.orderId,
    });
    return { id: "dev-console", ok: true };
  }

  // ── Provider path: Resend REST API ──
  try {
    const providerMessageId = await sendViaResend(apiKey, from, { ...input, to });
    await writeLog({
      to,
      subject: input.subject,
      template,
      status: "sent",
      providerMessageId,
      orderId: input.orderId,
    });
    return { id: providerMessageId, ok: true };
  } catch (err) {
    const error = safeError(err);
    console.error(`[email] send failed (template=${template}, to=${to}): ${error}`);
    await writeLog({
      to,
      subject: input.subject,
      template,
      status: "failed",
      error,
      orderId: input.orderId,
    });
    return { id: "", ok: false };
  }
}
