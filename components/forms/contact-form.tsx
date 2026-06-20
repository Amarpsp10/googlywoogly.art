"use client";

import { useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Script from "next/script";
import { Send } from "lucide-react";
import { contactSchema, type ContactInput } from "@/lib/validations/leads";
import { submitContact, type LeadFormState } from "@/app/actions/leads";
import { publicEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Contact form (`/contact`, doc 15). Validates client-side with `contactSchema`
 * (react-hook-form + zod resolver) AND server-side via `submitContact`
 * (the server is authoritative — doc 05 FR-22). Field-level server errors are
 * mapped back onto inputs; result is announced via sonner toast + an
 * `aria-live` region; the form resets on success (WCAG 2.1 AA).
 *
 * A hidden `website` honeypot traps bots (doc 05 §6.3).
 */

const MESSAGE_MAX = 2000;

/**
 * RHF `setValueAs` for the optional phone input: a blank field becomes
 * `undefined` (not `""`) so `phoneSchema.optional()` skips it rather than running
 * the digit transform on `""` and reporting a false "invalid number" error.
 */
function emptyToUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() === ""
    ? undefined
    : (value as string);
}

export function ContactForm() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const formId = useId();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
      website: "",
    },
  });

  const messageValue = watch("message") ?? "";
  const turnstileSiteKey = publicEnv.turnstileSiteKey;

  const onSubmit = handleSubmit((values, event) => {
    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("email", values.email);
    formData.set("phone", values.phone ?? "");
    formData.set("subject", values.subject ?? "");
    formData.set("message", values.message);
    formData.set("website", values.website ?? "");
    // Turnstile token: the widget injects a hidden `turnstileToken` input into
    // this form; forward it for server-side verification (empty when unconfigured).
    formData.set("turnstileToken", readTurnstileToken(event?.currentTarget));

    const initial: LeadFormState = { ok: false, message: "" };
    startTransition(async () => {
      const result = await submitContact(initial, formData);
      if (result.ok) {
        toast.success(result.message);
        setStatus({ ok: true, message: result.message });
        reset();
        return;
      }
      // Map server-side field errors back onto the form.
      if (result.fieldErrors) {
        for (const [name, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.length && name in values) {
            setError(name as keyof ContactInput, {
              type: "server",
              message: messages[0],
            });
          }
        }
      }
      toast.error(result.message);
      setStatus({ ok: false, message: result.message });
    });
  });

  const describedBy = (name: string, hasError: boolean) =>
    hasError ? `${formId}-${name}-error` : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={`${formId}-phone`}
          label="Phone"
          hint="Optional · WhatsApp friendly"
          error={errors.phone?.message}
          errorId={`${formId}-phone-error`}
        >
          <Input
            id={`${formId}-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="9XXXXXXXXX"
            aria-invalid={!!errors.phone}
            aria-describedby={describedBy("phone", !!errors.phone)}
            {...register("phone", { setValueAs: emptyToUndefined })}
          />
        </Field>

        <Field
          id={`${formId}-subject`}
          label="Subject"
          hint="Optional"
          error={errors.subject?.message}
          errorId={`${formId}-subject-error`}
        >
          <Input
            id={`${formId}-subject`}
            autoComplete="off"
            placeholder="How can we help?"
            aria-invalid={!!errors.subject}
            aria-describedby={describedBy("subject", !!errors.subject)}
            {...register("subject")}
          />
        </Field>
      </div>

      <Field
        id={`${formId}-message`}
        label="Message"
        required
        error={errors.message?.message}
        errorId={`${formId}-message-error`}
      >
        <Textarea
          id={`${formId}-message`}
          rows={5}
          maxLength={MESSAGE_MAX}
          placeholder="Tell us a little about what you're looking for…"
          aria-required="true"
          aria-invalid={!!errors.message}
          aria-describedby={describedBy("message", !!errors.message)}
          {...register("message")}
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {messageValue.length}/{MESSAGE_MAX}
        </p>
      </Field>

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          By submitting, you agree to our{" "}
          <a href="/privacy-policy" className="text-primary underline-offset-2 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="rounded-full"
        >
          <Send className="size-4" />
          {isPending ? "Sending…" : "Send message"}
        </Button>
      </div>

      {/* Polite live region for assistive tech (toast is visual-only). */}
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "text-sm",
          status ? (status.ok ? "text-foreground" : "text-destructive") : "sr-only",
        )}
      >
        {status?.message}
      </p>
    </form>
  );
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
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
