"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PaymentStatus } from "@prisma/client";

import { setPaymentStatus } from "../actions";
import { PAYMENT_STATUS } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/money";
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
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Payment control (docs/12 FR-28 / FR-9). Sets `paymentStatus` on its own axis —
 * independent of fulfillment. Payment has no enforced graph, so every enum value
 * is offered; a backward jump (e.g. paid → unpaid) warns inline but never blocks.
 * Optionally records a ₹ amount (→ paise) and a `[Payment]` timeline note.
 * Calls the typed `setPaymentStatus` Server Action via `useTransition`.
 */

// Recommended natural order for the picker (docs/12 FR-9).
const PAYMENT_ORDER: PaymentStatus[] = [
  PaymentStatus.unpaid,
  PaymentStatus.awaiting_payment,
  PaymentStatus.paid,
  PaymentStatus.partially_paid,
  PaymentStatus.refunded,
];

/** Payment ranks for the "backward jump" warning. */
const PAYMENT_RANK: Record<PaymentStatus, number> = {
  unpaid: 0,
  awaiting_payment: 1,
  paid: 3,
  partially_paid: 2,
  refunded: 4,
};

export function OrderPaymentControl({
  orderId,
  currentPaymentStatus,
}: {
  orderId: string;
  currentPaymentStatus: PaymentStatus;
}) {
  const [open, setOpen] = React.useState(false);
  const [next, setNext] = React.useState<PaymentStatus>(currentPaymentStatus);
  const [amount, setAmount] = React.useState("");
  const [addNote, setAddNote] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  // Reset the form whenever the dialog opens.
  React.useEffect(() => {
    if (open) {
      setNext(currentPaymentStatus);
      setAmount("");
      setAddNote(false);
      setNote("");
    }
  }, [open, currentPaymentStatus]);

  const showsAmount =
    next === "paid" || next === "partially_paid" || next === "refunded";
  const isBackward = PAYMENT_RANK[next] < PAYMENT_RANK[currentPaymentStatus];
  const unchanged = next === currentPaymentStatus;

  function submit() {
    const amountTrim = amount.trim();
    const amountPaid =
      showsAmount && amountTrim !== ""
        ? rupeesToPaise(Number(amountTrim))
        : undefined;

    if (amountPaid !== undefined && (!Number.isFinite(amountPaid) || amountPaid < 0)) {
      toast.error("Enter a valid amount.");
      return;
    }

    startTransition(async () => {
      const result = await setPaymentStatus({
        orderId,
        paymentStatus: next,
        amountPaid,
        addTimelineNote: addNote && note.trim() !== "",
        note: addNote ? note.trim() : undefined,
      });
      if (result.ok) {
        toast.success(`Payment marked ${PAYMENT_STATUS[result.data.paymentStatus].label}.`);
        setOpen(false);
      } else {
        toast.error(result.error || "Could not update payment.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full">
          Update payment
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Update payment</DialogTitle>
          <DialogDescription>
            Record offline payment state. This does not change fulfillment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField label="Payment status">
            <AdminSelect
              value={next}
              onChange={(e) => setNext(e.target.value as PaymentStatus)}
            >
              {PAYMENT_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PAYMENT_STATUS[p].label}
                </option>
              ))}
            </AdminSelect>
          </FormField>

          {isBackward ? (
            <p className="rounded-lg bg-accent/30 px-3 py-2 text-xs text-foreground">
              You&rsquo;re moving payment backward (
              {PAYMENT_STATUS[currentPaymentStatus].label} →{" "}
              {PAYMENT_STATUS[next].label}). That&rsquo;s allowed — just confirming
              it&rsquo;s intentional.
            </p>
          ) : null}

          {showsAmount ? (
            <FormField label="Amount (₹)" hint="Optional — for your reconciliation.">
              <AdminInput
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 2897"
              />
            </FormField>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addNote}
              onChange={(e) => setAddNote(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Add a note to the timeline
          </label>

          {addNote ? (
            <FormField label="Payment note" hint="Shown on the internal timeline only.">
              <AdminTextarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="e.g. Received ₹2,897 via UPI"
              />
            </FormField>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || unchanged}
            aria-busy={pending || undefined}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
