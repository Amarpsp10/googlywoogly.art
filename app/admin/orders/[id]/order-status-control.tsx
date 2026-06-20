"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, MessageCircle } from "lucide-react";
import { OrderStatus } from "@prisma/client";

import { transitionOrderStatus, markShipped } from "../actions";
import {
  COURIERS,
  NOTIFY_DEFAULTS,
  PRIMARY_NEXT,
  advanceLabel,
} from "../order-messages";
import { ORDER_STATUS } from "@/lib/constants";
import {
  FormField,
  AdminSelect,
  AdminInput,
  AdminTextarea,
} from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Fulfillment status control (docs/12 FR-27). Shows a primary, context-aware
 * **Advance** button (the most likely next legal transition) plus a **Change
 * status** picker of the other legal targets (CANON §7 — the server re-checks via
 * `canTransitionOrder`). Selecting a transition opens a confirm dialog carrying:
 *  - an optional note,
 *  - notification-channel checkboxes (defaults per FR-15),
 *  - transition-specific fields: courier + tracking (`→ shipped`, FR-6),
 *    reason (`→ cancelled` / `→ on_hold`).
 *
 * `→ shipped` calls `markShipped`; all others call `transitionOrderStatus`. Both
 * are typed Server Actions invoked via `useTransition`. When the founder ticks
 * WhatsApp, the action returns a prefilled `wa.me` link the UI surfaces to open.
 */

function labelFor(target: OrderStatus): string {
  return advanceLabel(target, ORDER_STATUS[target].label);
}

export function OrderStatusControl({
  orderId,
  currentStatus,
  legalTargets,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  legalTargets: OrderStatus[];
}) {
  const [target, setTarget] = React.useState<OrderStatus | null>(null);
  const [note, setNote] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [courier, setCourier] = React.useState<string>(COURIERS[0]);
  const [tracking, setTracking] = React.useState("");
  const [trackingUrl, setTrackingUrl] = React.useState("");
  const [notifyEmail, setNotifyEmail] = React.useState(false);
  const [notifyWhatsApp, setNotifyWhatsApp] = React.useState(false);
  const [whatsappUrl, setWhatsappUrl] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const primary = PRIMARY_NEXT[currentStatus];
  const primaryTarget = primary && legalTargets.includes(primary) ? primary : null;
  const otherTargets = legalTargets.filter((t) => t !== primaryTarget);

  const dialogOpen = target !== null;

  /** Open the confirm dialog for a target, seeding notify defaults (FR-15). */
  function openFor(next: OrderStatus) {
    const defaults = NOTIFY_DEFAULTS[next] ?? { email: false, whatsapp: false };
    setTarget(next);
    setNote("");
    setReason("");
    setCourier(COURIERS[0]);
    setTracking("");
    setTrackingUrl("");
    setNotifyEmail(defaults.email);
    setNotifyWhatsApp(defaults.whatsapp);
    setWhatsappUrl(null);
  }

  function closeDialog() {
    setTarget(null);
    setWhatsappUrl(null);
  }

  function submit() {
    if (!target) return;
    const notify = { email: notifyEmail, whatsapp: notifyWhatsApp, sms: false };

    if (target === "shipped") {
      if (tracking.trim() === "") {
        toast.error("Tracking number is required to mark shipped.");
        return;
      }
      startTransition(async () => {
        const result = await markShipped({
          orderId,
          courierName: courier,
          trackingNumber: tracking.trim(),
          trackingUrl: trackingUrl.trim() || undefined,
          note: note.trim() || undefined,
          notify,
          expectedCurrentStatus: currentStatus,
        });
        handleResult(result, "shipped");
      });
      return;
    }

    startTransition(async () => {
      const result = await transitionOrderStatus({
        orderId,
        toStatus: target,
        note: note.trim() || undefined,
        reason:
          target === "cancelled" || target === "on_hold"
            ? reason.trim() || undefined
            : undefined,
        notify,
        expectedCurrentStatus: currentStatus,
      });
      handleResult(result, target);
    });
  }

  function handleResult(
    result: Awaited<ReturnType<typeof transitionOrderStatus>>,
    next: OrderStatus,
  ) {
    if (result.ok) {
      toast.success(`Order marked ${ORDER_STATUS[next].label}.`);
      if (result.data.whatsappUrl) {
        // Keep the dialog open to reveal the WhatsApp send link (FR-14).
        setWhatsappUrl(result.data.whatsappUrl);
      } else {
        closeDialog();
      }
    } else {
      toast.error(result.error || "Could not update status.");
    }
  }

  const isTerminal = legalTargets.length === 0;

  return (
    <div className="space-y-2">
      {isTerminal ? (
        <p className="text-sm text-muted-foreground">
          This order is {ORDER_STATUS[currentStatus].label.toLowerCase()} — no
          further status changes.
        </p>
      ) : (
        <>
          {primaryTarget ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => openFor(primaryTarget)}
            >
              {labelFor(primaryTarget)}
            </Button>
          ) : null}

          {otherTargets.length > 0 ? (
            <div>
              <label htmlFor="order-change-status" className="sr-only">
                Change status
              </label>
              <AdminSelect
                id="order-change-status"
                value=""
                onChange={(e) => {
                  const v = e.target.value as OrderStatus;
                  if (v) openFor(v);
                  e.currentTarget.selectedIndex = 0;
                }}
              >
                <option value="">Change status…</option>
                {otherTargets.map((t) => (
                  <option key={t} value={t}>
                    {labelFor(t)}
                  </option>
                ))}
              </AdminSelect>
            </div>
          ) : null}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? null : closeDialog())}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {target
                ? `${ORDER_STATUS[currentStatus].label} → ${ORDER_STATUS[target].label}`
                : "Change status"}
            </DialogTitle>
            <DialogDescription>
              {target === "cancelled"
                ? "Cancelling is final and cannot be undone."
                : "Confirm this status change and choose how to notify the customer."}
            </DialogDescription>
          </DialogHeader>

          {whatsappUrl ? (
            // Success state: status changed; offer the prefilled WhatsApp send.
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Status updated. Send the customer a prefilled WhatsApp message:
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                <MessageCircle className="size-4" aria-hidden />
                Open WhatsApp
              </a>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {target === "shipped" ? (
                  <>
                    <FormField label="Courier" required>
                      <AdminSelect
                        value={courier}
                        onChange={(e) => setCourier(e.target.value)}
                      >
                        {COURIERS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </AdminSelect>
                    </FormField>
                    <FormField label="Tracking number" required>
                      <AdminInput
                        value={tracking}
                        onChange={(e) => setTracking(e.target.value)}
                        placeholder="AWB / tracking no."
                        maxLength={60}
                      />
                    </FormField>
                    <FormField label="Tracking URL" hint="Optional courier link.">
                      <AdminInput
                        type="url"
                        value={trackingUrl}
                        onChange={(e) => setTrackingUrl(e.target.value)}
                        placeholder="https://…"
                        maxLength={300}
                      />
                    </FormField>
                  </>
                ) : null}

                {target === "cancelled" || target === "on_hold" ? (
                  <FormField
                    label="Reason"
                    hint="Shared with the customer in the message."
                  >
                    <AdminTextarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder={
                        target === "cancelled"
                          ? "e.g. Item unavailable"
                          : "e.g. Awaiting a design detail"
                      }
                    />
                  </FormField>
                ) : null}

                <FormField label="Note" hint="Optional — added to the timeline.">
                  <AdminTextarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="Internal/contextual note…"
                  />
                </FormField>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-foreground">
                    Notify customer
                  </legend>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.checked)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    Email an update
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={notifyWhatsApp}
                      onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    Prepare a WhatsApp message (you tap to send)
                  </label>
                </fieldset>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submit}
                  disabled={pending}
                  aria-busy={pending || undefined}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <ChevronRight className="size-4" aria-hidden />
                  )}
                  {target ? labelFor(target) : "Confirm"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
