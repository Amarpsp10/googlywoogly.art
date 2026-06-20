"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle, Send, ShoppingBag } from "lucide-react";
import { bulkInquirySchema, type BulkInquiryInput } from "@/lib/validations/leads";
import { submitBulkInquiry, type LeadFormState } from "@/app/actions/leads";
import { OCCASIONS } from "@/lib/constants";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import Script from "next/script";
import { publicEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Corporate / bulk gifting inquiry form (`/bulk-orders`, doc 05 §4.14/§6.1).
 *
 * Validates client-side with `bulkInquirySchema` (react-hook-form + zod
 * resolver) AND server-side via `submitBulkInquiry` (the server re-validates —
 * doc 05 FR-22). On success the form is replaced by an on-page thank-you card
 * with a **"Continue on WhatsApp"** deep-link prefilled with the inquiry summary
 * (FR-18) plus a browse CTA. Budget is entered in **₹** (`budgetRupees`); the
 * service stores it as paise (CANON §10). A hidden `website` honeypot traps bots.
 */

const MESSAGE_MAX = 2000;
const NONE = "__none__"; // sentinel for the "no occasion chosen" select option

/** Today's date in IST as a `yyyy-mm-dd` string, for the deadline input `min`. */
function todayIST(): string {
  // en-CA yields ISO-ordered yyyy-mm-dd; pin to Asia/Kolkata (CANON §10).
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
}

/** Snapshot of a successful submission, used to build the WhatsApp summary. */
interface SubmittedSummary {
  name: string;
  company?: string;
  quantity?: string;
  occasion?: string;
  deadline?: string;
}

export function BulkOrderForm({
  whatsappNumber,
}: {
  whatsappNumber: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState<SubmittedSummary | null>(null);
  const [formError, setFormError] = useState<string>("");
  const formId = useId();
  const minDeadline = useMemo(todayIST, []);

  const {
    register,
    handleSubmit,
    control,
    setError,
    watch,
    formState: { errors },
  } = useForm<BulkInquiryInput>({
    resolver: zodResolver(bulkInquirySchema),
    defaultValues: {
      name: "",
      company: "",
      phone: "",
      email: "",
      productInterest: "",
      occasion: "",
      message: "",
      website: "",
    },
  });

  const messageValue = watch("message") ?? "";
  const turnstileSiteKey = publicEnv.turnstileSiteKey;

  const onSubmit = handleSubmit((values, event) => {
    setFormError("");
    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("company", values.company ?? "");
    formData.set("phone", values.phone);
    formData.set("email", values.email);
    formData.set("productInterest", values.productInterest ?? "");
    formData.set(
      "quantity",
      values.quantity == null ? "" : String(values.quantity),
    );
    formData.set("occasion", values.occasion ?? "");
    formData.set(
      "budget",
      values.budgetRupees == null ? "" : String(values.budgetRupees),
    );
    formData.set("deadline", deadlineRaw(values.deadline));
    formData.set("message", values.message);
    formData.set("website", values.website ?? "");
    // Turnstile token: the widget injects a hidden `turnstileToken` input into
    // this form; forward it for server-side verification (empty when unconfigured).
    formData.set("turnstileToken", readTurnstileToken(event?.currentTarget));

    const initial: LeadFormState = { ok: false, message: "" };
    startTransition(async () => {
      const result = await submitBulkInquiry(initial, formData);
      if (result.ok) {
        toast.success(result.message);
        setSubmitted({
          name: values.name,
          company: values.company?.trim() || undefined,
          quantity:
            values.quantity == null ? undefined : String(values.quantity),
          occasion: values.occasion?.trim() || undefined,
          deadline: deadlineRaw(values.deadline) || undefined,
        });
        return;
      }
      if (result.fieldErrors) {
        for (const [name, messages] of Object.entries(result.fieldErrors)) {
          if (!messages?.length) continue;
          // `budget` (paise field name) maps back to the UI `budgetRupees`.
          const fieldName = name === "budget" ? "budgetRupees" : name;
          if (fieldName in values) {
            setError(fieldName as keyof BulkInquiryInput, {
              type: "server",
              message: messages[0],
            });
          }
        }
      }
      setFormError(result.message);
      toast.error(result.message);
    });
  });

  // ── Success state (replaces the form) ──────────────────────────────────
  if (submitted) {
    const summary = buildBulkSummary(submitted);
    const waLink = buildWhatsAppLink(whatsappNumber, summary);
    return (
      <div
        className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-pastel-mint/50 text-foreground">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </div>
        <h3 className="font-serif text-2xl font-bold" tabIndex={-1}>
          Thanks, {submitted.name}!
        </h3>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground text-pretty">
          We&apos;ve received your inquiry and will reply within 1 business day
          with a personal quote. Prefer to talk now? Continue on WhatsApp and
          we&apos;ll pick up right where you left off.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {waLink && (
            <Button asChild size="lg" className="w-full rounded-full sm:w-auto">
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-5" />
                Continue on WhatsApp
              </a>
            </Button>
          )}
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full rounded-full sm:w-auto"
          >
            <a href="/products">
              <ShoppingBag className="size-5" />
              Browse gift ideas
            </a>
          </Button>
        </div>
      </div>
    );
  }

  const describedBy = (name: string, hasError: boolean) =>
    hasError ? `${formId}-${name}-error` : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {/* Honeypot — visually hidden, off the a11y tree, not auto-filled. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor={`${formId}-website`}>Leave this field empty</label>
        <input
          id={`${formId}-website`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>

      {/* Contact details */}
      <fieldset className="space-y-5">
        <legend className="mb-1 font-serif text-lg font-semibold">
          Your details
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id={`${formId}-name`}
            label="Your name"
            required
            error={errors.name?.message}
            errorId={`${formId}-name-error`}
          >
            <Input
              id={`${formId}-name`}
              autoComplete="name"
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={describedBy("name", !!errors.name)}
              {...register("name")}
            />
          </Field>

          <Field
            id={`${formId}-company`}
            label="Company / organisation"
            hint="Optional"
            error={errors.company?.message}
            errorId={`${formId}-company-error`}
          >
            <Input
              id={`${formId}-company`}
              autoComplete="organization"
              aria-invalid={!!errors.company}
              aria-describedby={describedBy("company", !!errors.company)}
              {...register("company")}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id={`${formId}-phone`}
            label="Phone (WhatsApp)"
            required
            error={errors.phone?.message}
            errorId={`${formId}-phone-error`}
          >
            <Input
              id={`${formId}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="9XXXXXXXXX"
              aria-required="true"
              aria-invalid={!!errors.phone}
              aria-describedby={describedBy("phone", !!errors.phone)}
              {...register("phone")}
            />
          </Field>

          <Field
            id={`${formId}-email`}
            label="Email"
            required
            error={errors.email?.message}
            errorId={`${formId}-email-error`}
          >
            <Input
              id={`${formId}-email`}
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-required="true"
              aria-invalid={!!errors.email}
              aria-describedby={describedBy("email", !!errors.email)}
              {...register("email")}
            />
          </Field>
        </div>
      </fieldset>

      {/* About the gift */}
      <fieldset className="space-y-5">
        <legend className="mb-1 font-serif text-lg font-semibold">
          About your gift
        </legend>

        <Field
          id={`${formId}-productInterest`}
          label="What are you interested in?"
          hint="Optional · e.g. hampers, custom branded sets"
          error={errors.productInterest?.message}
          errorId={`${formId}-productInterest-error`}
        >
          <Input
            id={`${formId}-productInterest`}
            placeholder="Hampers, desk décor, custom designs…"
            aria-invalid={!!errors.productInterest}
            aria-describedby={describedBy(
              "productInterest",
              !!errors.productInterest,
            )}
            {...register("productInterest")}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id={`${formId}-quantity`}
            label="Quantity (approx.)"
            hint="Optional"
            error={errors.quantity?.message}
            errorId={`${formId}-quantity-error`}
          >
            <Input
              id={`${formId}-quantity`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="e.g. 50"
              aria-invalid={!!errors.quantity}
              aria-describedby={describedBy("quantity", !!errors.quantity)}
              {...register("quantity", { setValueAs: emptyToUndefinedNumber })}
            />
          </Field>

          <Field
            id={`${formId}-occasion`}
            label="Occasion"
            hint="Optional"
            error={errors.occasion?.message}
            errorId={`${formId}-occasion-error`}
          >
            <Controller
              control={control}
              name="occasion"
              render={({ field: f }) => (
                <Select
                  value={f.value ? f.value : NONE}
                  onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
                >
                  <SelectTrigger
                    id={`${formId}-occasion`}
                    className="w-full"
                    aria-invalid={!!errors.occasion}
                    aria-describedby={describedBy(
                      "occasion",
                      !!errors.occasion,
                    )}
                  >
                    <SelectValue placeholder="Select an occasion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No specific occasion</SelectItem>
                    {OCCASIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id={`${formId}-budget`}
            label="Budget (approx., ₹)"
            hint="Optional · per unit or total"
            error={errors.budgetRupees?.message}
            errorId={`${formId}-budget-error`}
          >
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                aria-hidden="true"
              >
                ₹
              </span>
              <Input
                id={`${formId}-budget`}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="50000"
                className="pl-7"
                aria-invalid={!!errors.budgetRupees}
                aria-describedby={describedBy(
                  "budget",
                  !!errors.budgetRupees,
                )}
                {...register("budgetRupees", {
                  setValueAs: emptyToUndefinedNumber,
                })}
              />
            </div>
          </Field>

          <Field
            id={`${formId}-deadline`}
            label="Needed by"
            hint="Optional"
            error={errors.deadline?.message}
            errorId={`${formId}-deadline-error`}
          >
            <Input
              id={`${formId}-deadline`}
              type="date"
              min={minDeadline}
              aria-invalid={!!errors.deadline}
              aria-describedby={describedBy("deadline", !!errors.deadline)}
              {...register("deadline", { setValueAs: emptyToUndefined })}
            />
          </Field>
        </div>
      </fieldset>

      {/* The brief */}
      <fieldset className="space-y-5">
        <legend className="mb-1 font-serif text-lg font-semibold">
          Your brief
        </legend>
        <Field
          id={`${formId}-message`}
          label="Tell us what you need"
          required
          error={errors.message?.message}
          errorId={`${formId}-message-error`}
        >
          <Textarea
            id={`${formId}-message`}
            rows={5}
            maxLength={MESSAGE_MAX}
            placeholder="Share quantities, branding ideas, delivery locations, or any specifics — the more detail, the better the quote."
            aria-required="true"
            aria-invalid={!!errors.message}
            aria-describedby={describedBy("message", !!errors.message)}
            {...register("message")}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {messageValue.length}/{MESSAGE_MAX}
          </p>
        </Field>
      </fieldset>

      {/* Cloudflare Turnstile — only when configured. Implicit render injects a
          hidden `turnstileToken` input into this form, verified server-side. */}
      {turnstileSiteKey && (
        <div>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="lazyOnload"
          />
          <div
            className="cf-turnstile"
            data-sitekey={turnstileSiteKey}
            data-response-field-name="turnstileToken"
          />
        </div>
      )}

      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          By submitting, you agree to our{" "}
          <a href="/privacy-policy" className="text-primary underline-offset-2 hover:underline">
            Privacy Policy
          </a>
          . We&apos;ll only use your details to prepare your quote.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="w-full rounded-full sm:w-auto"
          >
            <Send className="size-4" />
            {isPending ? "Sending…" : "Send my inquiry"}
          </Button>
          {buildWhatsAppLink(whatsappNumber) && (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full rounded-full sm:w-auto"
            >
              <a
                href={buildWhatsAppLink(
                  whatsappNumber,
                  "Hi GooglyWoogly Art! 👋 I'd like to talk about corporate / bulk gifting.",
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-5" />
                Prefer to chat? WhatsApp us
              </a>
            </Button>
          )}
        </div>
        {formError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {formError}
          </p>
        )}
      </div>
    </form>
  );
}

/**
 * RHF `setValueAs` for optional native inputs: a blank field becomes `undefined`
 * (not `""`) so `z.coerce.*().optional()` treats it as "not provided" rather than
 * coercing `""` → `0` / Invalid Date and tripping a false validation error.
 */
function emptyToUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() === "" ? undefined : (value as string);
}

/** As above, but yields a `number` for numeric inputs (or `undefined` when blank). */
function emptyToUndefinedNumber(value: unknown): number | undefined {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return undefined;
  }
  return Number(value);
}

/**
 * Read the Cloudflare Turnstile token from the hidden input the widget injects
 * into the form (named `turnstileToken` via `data-response-field-name`). Returns
 * `""` when Turnstile isn't configured/rendered — the server treats that as a
 * graceful no-op when `TURNSTILE_SECRET_KEY` is unset.
 */
function readTurnstileToken(form: HTMLFormElement | null | undefined): string {
  if (!form) return "";
  const field = form.elements.namedItem("turnstileToken");
  return field instanceof HTMLInputElement ? field.value : "";
}

/** Read a deadline value (RHF gives a Date after zod coercion, or a raw string). */
function deadlineRaw(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
      value,
    );
  }
  return typeof value === "string" ? value : "";
}

/** Compose the WhatsApp continuation message from the submitted summary. */
function buildBulkSummary(s: SubmittedSummary): string {
  const lines = [
    "Hi GooglyWoogly Art! 👋 I just sent a bulk / corporate gifting inquiry.",
    "",
    `Name: ${s.name}`,
  ];
  if (s.company) lines.push(`Company: ${s.company}`);
  if (s.quantity) lines.push(`Quantity: ${s.quantity}`);
  if (s.occasion) lines.push(`Occasion: ${s.occasion}`);
  if (s.deadline) lines.push(`Needed by: ${s.deadline}`);
  lines.push("", "Could you help me with a quote? Thank you!");
  return lines.join("\n");
}

/** Labelled field wrapper with hint + accessible error message. */
function Field({
  id,
  label,
  required,
  hint,
  error,
  errorId,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  errorId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={errorId} className={cn("text-sm font-medium text-destructive")}>
          {error}
        </p>
      )}
    </div>
  );
}
