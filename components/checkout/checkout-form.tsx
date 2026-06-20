"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import {
  checkoutSchema,
  CHECKOUT_LIMITS,
  type CheckoutInput,
} from "@/lib/validations/checkout";
import { INDIAN_STATES } from "@/lib/constants";
import { computeCartTotals, freeShippingRemaining } from "@/lib/services/pricing";
import { formatPaise } from "@/lib/money";
import { placeOrder } from "@/app/actions/order";
import { useCart } from "@/components/cart/cart-provider";

import { EmptyState } from "@/components/storefront/empty-state";
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
import { safeRandomUUID } from "@/lib/uuid";
import type { ShippingDefaults } from "@/types";

/**
 * Single-page guest checkout (`/checkout`, doc `08` §4.3). No on-site payment —
 * the form captures *intent only*; money moves on WhatsApp after the founder
 * confirms stock (`08` FR-16/§1.2). Renders nothing the cart can't supply, so it
 * is a client leaf reading the localStorage cart via `useCart()`.
 *
 * Validation is layered (`08` FR-14): client-side here with
 * `react-hook-form` + `zodResolver(checkoutSchema)`, then **re-validated and
 * re-priced server-side** inside `placeOrder` (the server is authoritative — it
 * ignores client money, `08` FR-29/FR-30). A hidden `website` honeypot traps
 * bots; on success we `clear()` the cart and route to the token-gated
 * confirmation page (`08` FR-36).
 *
 * The order summary mirrors the cart math exactly via the shared
 * `computeCartTotals`, so the preview can never drift from placement.
 */

/** RHF values: just the user-entered fields. `items`/`clientRequestId` are built
 *  from the cart at submit, so the form schema is the checkout schema minus them. */
type CheckoutFormValues = Omit<CheckoutInput, "items" | "clientRequestId">;

const checkoutFormSchema = checkoutSchema.omit({
  items: true,
  clientRequestId: true,
});

export function CheckoutForm({
  shippingDefaults,
}: {
  shippingDefaults: ShippingDefaults;
}) {
  const router = useRouter();
  const { items, hydrated, clear } = useCart();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>("");
  const formId = useId();

  // Honeypot lives outside RHF (it's not part of `checkoutSchema`). A real user
  // never sees or fills it; a filled value means a bot — we silently no-op.
  const honeypotRef = useRef<HTMLInputElement>(null);

  // Stable idempotency key per attempt: reused across retries so a silently-
  // succeeded first submit can't double-book (`08` FR-38/FR-39).
  const clientRequestIdRef = useRef<string>("");

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    // Validate per-field once it's been touched (matches the admin product
    // form). The submit button is never gated on `isValid`, so the buyer can
    // always click "Place order" and get clear per-field errors — never a
    // silently-disabled dead-end.
    mode: "onTouched",
    defaultValues: {
      contact: { customerName: "", customerPhone: "", customerEmail: "" },
      shippingAddress: {
        fullName: "",
        phone: "",
        line1: "",
        line2: "",
        landmark: "",
        city: "",
        // `state` is a required enum; leave undefined so the Select shows its
        // placeholder and validation fires if the buyer skips it.
        pincode: "",
        country: "IN",
      },
      customerNote: "",
      giftMessage: "",
    },
  });

  // Live totals — recomputed from the cart with the same pure helper the server
  // uses, so the on-screen preview matches the authoritative placement math.
  const totals = useMemo(
    () =>
      computeCartTotals(
        items.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
        shippingDefaults,
      ),
    [items, shippingDefaults],
  );
  const freeShipRemaining = useMemo(
    () => freeShippingRemaining(totals.subtotal, shippingDefaults),
    [totals.subtotal, shippingDefaults],
  );

  // Any client-side validation error present? Used to show a "fix the
  // highlighted fields" prompt next to the submit button (the left-column
  // banner can be off-screen on the desktop two-column layout).
  const hasFieldErrors = Object.keys(errors).length > 0;

  const onSubmit = handleSubmit((values) => {
    // Honeypot tripped → pretend success-ish no-op (never reveal the trap).
    if (honeypotRef.current?.value) return;

    setFormError("");

    // Cart can empty between render and submit (cross-tab, expiry).
    if (items.length === 0) {
      setFormError("Your cart is empty.");
      toast.error("Your cart is empty.");
      return;
    }

    // One idempotency id per logical attempt; only mint a fresh one if we don't
    // already hold one (so a retry after a network blip reuses it).
    if (!clientRequestIdRef.current) {
      // NOT crypto.randomUUID() — that's undefined outside secure contexts
      // (e.g. a plain-HTTP LAN IP), which would throw and silently kill submit.
      clientRequestIdRef.current = safeRandomUUID();
    }

    const payload: CheckoutInput = {
      contact: values.contact,
      shippingAddress: values.shippingAddress,
      customerNote: values.customerNote?.trim() || undefined,
      giftMessage: values.giftMessage?.trim() || undefined,
      clientRequestId: clientRequestIdRef.current,
      items: items.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        personalizationNote: line.personalizationNote || undefined,
        giftMessage: line.giftMessage || undefined,
      })),
    };

    startTransition(async () => {
      const result = await placeOrder(payload);

      if (result.ok) {
        // Clear only AFTER a confirmed success so a failure preserves the cart
        // (`08` FR-36); then hand off to the token-gated confirmation page.
        clear();
        router.push(`/order/confirmed/${result.data.trackingToken}`);
        return;
      }

      // Map any server-side field errors back onto a real, rendered input.
      // `placeOrder` re-validates with the *full* `checkoutSchema` and returns
      // `flatten().fieldErrors`, whose keys are the TOP-LEVEL object fields
      // (`contact`, `shippingAddress`, `items`, …) — not the dotted leaf paths
      // RHF registers (`contact.customerName`). Setting an error on the object
      // node would never render next to a field, so we point each known group
      // at its first visible input; anything else falls through to the
      // form-level banner below. This keeps server validation from silently
      // vanishing (the bug: errors that never surfaced).
      const SERVER_ERROR_TARGETS: Partial<
        Record<string, keyof CheckoutFormValues | `${string}.${string}`>
      > = {
        contact: "contact.customerName",
        shippingAddress: "shippingAddress.fullName",
        customerNote: "customerNote",
        giftMessage: "giftMessage",
      };
      if (result.fieldErrors) {
        for (const [name, messages] of Object.entries(result.fieldErrors)) {
          const target = SERVER_ERROR_TARGETS[name];
          if (target && messages?.length) {
            setError(target as keyof CheckoutFormValues, {
              type: "server",
              message: messages[0],
            });
          }
        }
      }

      // Always surface the message at the form level too, so a server-only
      // failure (rate limit, empty cart, an unmapped field) is never silent.
      // A fresh id on the next attempt would risk a duplicate if this call
      // silently committed; keep the same id (only cleared on success unmount).
      setFormError(result.error);
      toast.error(result.error);
    });
  });

  // ── Empty cart: block checkout, point back to the catalog (`08` FR-15/FR-22) ──
  if (!hydrated) {
    return (
      <div className="py-16 text-center text-muted-foreground" aria-live="polite">
        Loading your checkout…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-7" />}
        title="Your cart is empty"
        message="Add a handmade piece you love, then come back to check out."
        action={
          <Button asChild className="rounded-full">
            <Link href="/products">Browse gifts</Link>
          </Button>
        }
      />
    );
  }

  const describedBy = (key: string, hasError: boolean) =>
    hasError ? `${formId}-${key}-error` : undefined;

  return (
    // One <form> wraps both columns so the summary's submit button is inside it
    // (native submit + Enter-to-submit) while the layout stays two-column.
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-8 lg:grid-cols-[1fr_400px]"
    >
      {/* ── Left: the fields ── */}
      <div className="space-y-8">
        {/* Honeypot — visually hidden, off the a11y tree, never auto-filled. */}
        <div className="absolute left-[-9999px]" aria-hidden="true">
          <label htmlFor={`${formId}-website`}>Leave this field empty</label>
          <input
            ref={honeypotRef}
            id={`${formId}-website`}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {/* Contact */}
        <fieldset className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <legend className="px-1 font-serif text-lg font-semibold">
            Contact details
          </legend>

          <Field
            id={`${formId}-customerName`}
            label="Full name"
            required
            error={errors.contact?.customerName?.message}
            errorId={`${formId}-customerName-error`}
          >
            <Input
              id={`${formId}-customerName`}
              autoComplete="name"
              aria-required="true"
              aria-invalid={!!errors.contact?.customerName}
              aria-describedby={describedBy(
                "customerName",
                !!errors.contact?.customerName,
              )}
              className={inputClass}
              {...register("contact.customerName")}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id={`${formId}-customerPhone`}
              label="Phone (WhatsApp)"
              hint="We'll message you here"
              required
              error={errors.contact?.customerPhone?.message}
              errorId={`${formId}-customerPhone-error`}
            >
              <Input
                id={`${formId}-customerPhone`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="9XXXXXXXXX"
                aria-required="true"
                aria-invalid={!!errors.contact?.customerPhone}
                aria-describedby={describedBy(
                  "customerPhone",
                  !!errors.contact?.customerPhone,
                )}
                className={inputClass}
                {...register("contact.customerPhone")}
              />
            </Field>

            <Field
              id={`${formId}-customerEmail`}
              label="Email"
              hint="For your confirmation"
              required
              error={errors.contact?.customerEmail?.message}
              errorId={`${formId}-customerEmail-error`}
            >
              <Input
                id={`${formId}-customerEmail`}
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-required="true"
                aria-invalid={!!errors.contact?.customerEmail}
                aria-describedby={describedBy(
                  "customerEmail",
                  !!errors.contact?.customerEmail,
                )}
                className={inputClass}
                {...register("contact.customerEmail")}
              />
            </Field>
          </div>
        </fieldset>

        {/* Shipping address */}
        <fieldset className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <legend className="px-1 font-serif text-lg font-semibold">
            Shipping address
          </legend>

          <Field
            id={`${formId}-fullName`}
            label="Recipient name"
            required
            error={errors.shippingAddress?.fullName?.message}
            errorId={`${formId}-fullName-error`}
          >
            <Input
              id={`${formId}-fullName`}
              autoComplete="name"
              aria-required="true"
              aria-invalid={!!errors.shippingAddress?.fullName}
              aria-describedby={describedBy(
                "fullName",
                !!errors.shippingAddress?.fullName,
              )}
              className={inputClass}
              {...register("shippingAddress.fullName")}
            />
          </Field>

          <Field
            id={`${formId}-addrPhone`}
            label="Delivery phone"
            required
            error={errors.shippingAddress?.phone?.message}
            errorId={`${formId}-addrPhone-error`}
          >
            <Input
              id={`${formId}-addrPhone`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="9XXXXXXXXX"
              aria-required="true"
              aria-invalid={!!errors.shippingAddress?.phone}
              aria-describedby={describedBy(
                "addrPhone",
                !!errors.shippingAddress?.phone,
              )}
              className={inputClass}
              {...register("shippingAddress.phone")}
            />
          </Field>

          <Field
            id={`${formId}-line1`}
            label="Address line 1"
            required
            error={errors.shippingAddress?.line1?.message}
            errorId={`${formId}-line1-error`}
          >
            <Input
              id={`${formId}-line1`}
              autoComplete="address-line1"
              placeholder="House / flat no., street"
              aria-required="true"
              aria-invalid={!!errors.shippingAddress?.line1}
              aria-describedby={describedBy(
                "line1",
                !!errors.shippingAddress?.line1,
              )}
              className={inputClass}
              {...register("shippingAddress.line1")}
            />
          </Field>

          <Field
            id={`${formId}-line2`}
            label="Address line 2"
            hint="Optional"
            error={errors.shippingAddress?.line2?.message}
            errorId={`${formId}-line2-error`}
          >
            <Input
              id={`${formId}-line2`}
              autoComplete="address-line2"
              placeholder="Area, locality"
              aria-invalid={!!errors.shippingAddress?.line2}
              aria-describedby={describedBy(
                "line2",
                !!errors.shippingAddress?.line2,
              )}
              className={inputClass}
              {...register("shippingAddress.line2")}
            />
          </Field>

          <Field
            id={`${formId}-landmark`}
            label="Landmark"
            hint="Optional"
            error={errors.shippingAddress?.landmark?.message}
            errorId={`${formId}-landmark-error`}
          >
            <Input
              id={`${formId}-landmark`}
              placeholder="Near…"
              aria-invalid={!!errors.shippingAddress?.landmark}
              aria-describedby={describedBy(
                "landmark",
                !!errors.shippingAddress?.landmark,
              )}
              className={inputClass}
              {...register("shippingAddress.landmark")}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id={`${formId}-city`}
              label="City"
              required
              error={errors.shippingAddress?.city?.message}
              errorId={`${formId}-city-error`}
            >
              <Input
                id={`${formId}-city`}
                autoComplete="address-level2"
                aria-required="true"
                aria-invalid={!!errors.shippingAddress?.city}
                aria-describedby={describedBy(
                  "city",
                  !!errors.shippingAddress?.city,
                )}
                className={inputClass}
                {...register("shippingAddress.city")}
              />
            </Field>

            <Field
              id={`${formId}-state`}
              label="State"
              required
              error={errors.shippingAddress?.state?.message}
              errorId={`${formId}-state-error`}
            >
              <Controller
                control={control}
                name="shippingAddress.state"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id={`${formId}-state`}
                      className={cn(inputClass, "w-full")}
                      aria-required="true"
                      aria-invalid={!!errors.shippingAddress?.state}
                      aria-describedby={describedBy(
                        "state",
                        !!errors.shippingAddress?.state,
                      )}
                    >
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field
            id={`${formId}-pincode`}
            label="Pincode"
            required
            error={errors.shippingAddress?.pincode?.message}
            errorId={`${formId}-pincode-error`}
          >
            <Input
              id={`${formId}-pincode`}
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              placeholder="6-digit pincode"
              aria-required="true"
              aria-invalid={!!errors.shippingAddress?.pincode}
              aria-describedby={describedBy(
                "pincode",
                !!errors.shippingAddress?.pincode,
              )}
              className={cn(inputClass, "sm:max-w-48")}
              {...register("shippingAddress.pincode")}
            />
          </Field>
        </fieldset>

        {/* Notes & gift message */}
        <fieldset className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <legend className="px-1 font-serif text-lg font-semibold">
            Order note &amp; gift message
          </legend>

          <Field
            id={`${formId}-customerNote`}
            label="Order note"
            hint="Optional"
            error={errors.customerNote?.message}
            errorId={`${formId}-customerNote-error`}
          >
            <Textarea
              id={`${formId}-customerNote`}
              rows={3}
              maxLength={CHECKOUT_LIMITS.customerNote}
              placeholder="Anything we should know about your order?"
              aria-invalid={!!errors.customerNote}
              aria-describedby={describedBy(
                "customerNote",
                !!errors.customerNote,
              )}
              className={inputClass}
              {...register("customerNote")}
            />
          </Field>

          <Field
            id={`${formId}-giftMessage`}
            label="Gift message"
            hint="Optional · we'll include it with your gift"
            error={errors.giftMessage?.message}
            errorId={`${formId}-giftMessage-error`}
          >
            <Textarea
              id={`${formId}-giftMessage`}
              rows={3}
              maxLength={CHECKOUT_LIMITS.orderGiftMessage}
              placeholder="A short message for the recipient…"
              aria-invalid={!!errors.giftMessage}
              aria-describedby={describedBy(
                "giftMessage",
                !!errors.giftMessage,
              )}
              className={inputClass}
              {...register("giftMessage")}
            />
          </Field>
        </fieldset>

        {formError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {formError}
          </p>
        )}
      </div>

      {/* ── Right: live order summary + place-order CTA ── */}
      <aside className="h-fit lg:sticky lg:top-24">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-serif text-xl font-bold">Order summary</h2>

          <ul className="mt-4 space-y-4">
            {items.map((line) => (
              <li key={line.lineId} className="flex gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {line.imageUrl && (
                    <Image
                      src={line.imageUrl}
                      alt={line.title}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                  <span
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
                    aria-hidden="true"
                  >
                    {line.quantity}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {line.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Qty {line.quantity}
                  </span>
                  {line.madeToOrder && (
                    <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-pastel-lavender/40 px-2 py-0.5 text-[11px] font-medium">
                      <Sparkles className="size-3" aria-hidden="true" />
                      Made to order
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold">
                  {formatPaise(line.unitPrice * line.quantity)}
                </span>
              </li>
            ))}
          </ul>

          {freeShipRemaining > 0 ? (
            <p className="mt-5 rounded-xl bg-secondary/30 px-3 py-2 text-sm">
              Add <strong>{formatPaise(freeShipRemaining)}</strong> more for free
              shipping 🎉
            </p>
          ) : (
            <p className="mt-5 rounded-xl bg-pastel-mint/40 px-3 py-2 text-sm font-medium">
              You&apos;ve unlocked free shipping 🎉
            </p>
          )}

          {/* aria-live so screen readers hear totals update as the cart changes. */}
          <dl
            className="mt-4 space-y-2 text-sm"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-medium">{formatPaise(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="font-medium">
                {totals.shippingFee === 0
                  ? "Free"
                  : formatPaise(totals.shippingFee)}
              </dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd className="text-primary">{formatPaise(totals.grandTotal)}</dd>
            </div>
          </dl>

          {/* No-payment reassurance — must sit directly above the CTA (`08` §4.3). */}
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-accent/30 px-3 py-3 text-sm">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0 text-foreground"
              aria-hidden="true"
            />
            <p>
              <strong>No payment now.</strong> We&apos;ll confirm stock and share
              easy payment options on WhatsApp once Vanshika reviews your order.
            </p>
          </div>

          {/* Error feedback beside the CTA: on the desktop two-column layout
              the left-column banner is off-screen here, so repeat the reason a
              submit was blocked right next to the button the buyer just
              clicked. Shows the server/form-level message, or — when the click
              failed client-side validation — a prompt to fix the highlighted
              fields above. */}
          {(formError || hasFieldErrors) && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {formError ||
                "Please fix the highlighted fields above, then place your order."}
            </p>
          )}

          {/* The submit button is intentionally gated ONLY on `isPending` —
              never on `formState.isValid`. Hard-disabling on `!isValid` is the
              anti-pattern that left this button permanently un-clickable: the
              buyer fills the form but RHF's `isValid` can lag/stay false, with
              no feedback. Instead we always allow the click, let
              `handleSubmit` run the Zod resolver, and surface per-field +
              form-level errors. */}
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            aria-busy={isPending}
            className="mt-5 w-full rounded-full"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Placing your order…
              </>
            ) : (
              <>
                <Lock className="size-4" aria-hidden="true" />
                Place order · {formatPaise(totals.grandTotal)}
              </>
            )}
          </Button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <MessageCircle className="size-3.5" aria-hidden="true" />
            Payment &amp; confirmation happen on WhatsApp
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By placing your order you agree to our{" "}
          <Link
            href="/terms"
            className="text-primary underline-offset-2 hover:underline"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy-policy"
            className="text-primary underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </aside>
    </form>
  );
}

/** Theme-true input styling shared across every field (rounded, soft pink ring). */
const inputClass =
  "h-11 rounded-xl border-border bg-input/40 focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/** Labelled field wrapper with hint + accessible error message (matches the
 *  storefront lead forms). */
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
