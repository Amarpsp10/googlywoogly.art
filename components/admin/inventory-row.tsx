"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, SlidersHorizontal, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  AdminInput,
  AdminLabel,
  AdminSelect,
  AdminTextarea,
  FormField,
} from "@/components/admin/form-field";
import {
  AdminTableRow,
  AdminTableCell,
} from "@/components/admin/admin-table";
import { INVENTORY_STATE } from "@/lib/constants";
import { deriveInventoryState, type InventoryState } from "@/lib/inventory";
import { adjustInventory } from "@/app/admin/products/actions";
import { ADJUST_REASONS, type AdjustReason } from "@/lib/admin/product-rules";
import { cn } from "@/lib/utils";
import type { InventoryRow as InventoryRowData } from "@/lib/services/admin-products";

/**
 * `InventoryRow` — a stock row with inline quick-edit + a reasoned "Adjust"
 * sheet (docs/11 FR-43/45/46). Quantity, low-stock threshold and made-to-order
 * are inline-editable (blur/Enter saves via `adjustInventory`); the state badge
 * re-derives instantly (optimistic, with rollback + toast on error — FR-45).
 * The "Adjust" sheet does an absolute set OR a +/- delta with a REQUIRED reason
 * (audited — FR-46/47). Available to `staff`+ (server enforces).
 */

const REASON_LABELS: Record<AdjustReason, string> = {
  recount: "Recount",
  received_stock: "Received new stock",
  damaged: "Damaged",
  lost: "Lost",
  returned_to_stock: "Returned to stock",
  correction: "Correction",
  sold_offline: "Sold in person",
  other: "Other",
};

export function InventoryRow({ row }: { row: InventoryRowData }) {
  // Local optimistic state (server is the source of truth on save).
  const [qty, setQty] = React.useState(row.inventoryQuantity);
  const [threshold, setThreshold] = React.useState(row.lowStockThreshold);
  const [mto, setMto] = React.useState(row.madeToOrder);
  const [lead, setLead] = React.useState(row.productionLeadTimeDays);
  const [updatedAt, setUpdatedAt] = React.useState(row.updatedAt.toISOString());
  const [savingField, setSavingField] = React.useState<string | null>(null);

  // Draft strings for the inline number inputs.
  const [qtyDraft, setQtyDraft] = React.useState(String(row.inventoryQuantity));
  const [thresholdDraft, setThresholdDraft] = React.useState(String(row.lowStockThreshold));

  const state: InventoryState = deriveInventoryState({
    madeToOrder: mto,
    inventoryQuantity: qty,
    lowStockThreshold: threshold,
  });
  const meta = INVENTORY_STATE[state];

  const persist = React.useCallback(
    async (
      patch: Parameters<typeof adjustInventory>[0],
      field: string,
      optimistic: () => void,
      rollback: () => void,
    ) => {
      setSavingField(field);
      optimistic();
      const res = await adjustInventory({ ...(patch as object), expectedUpdatedAt: updatedAt });
      setSavingField(null);
      if (!res.ok) {
        rollback();
        toast.error(res.error);
        return false;
      }
      setQty(res.data.inventoryQuantity);
      setThreshold(res.data.lowStockThreshold);
      setMto(res.data.madeToOrder);
      setLead(res.data.productionLeadTimeDays);
      setQtyDraft(String(res.data.inventoryQuantity));
      setThresholdDraft(String(res.data.lowStockThreshold));
      // Bump the optimistic-concurrency token so chained edits don't conflict.
      setUpdatedAt(new Date().toISOString());
      return true;
    },
    [updatedAt],
  );

  const commitQty = () => {
    const next = Number(qtyDraft);
    if (!Number.isFinite(next) || next < 0 || next === qty) {
      setQtyDraft(String(qty));
      return;
    }
    const prev = qty;
    persist(
      { id: row.id, mode: "set", value: next, reason: "recount" },
      "qty",
      () => setQty(next),
      () => setQty(prev),
    );
  };

  const commitThreshold = () => {
    const next = Number(thresholdDraft);
    if (!Number.isFinite(next) || next < 0 || next === threshold) {
      setThresholdDraft(String(threshold));
      return;
    }
    const prev = threshold;
    persist(
      { id: row.id, mode: "set", value: qty, reason: "correction", lowStockThreshold: next },
      "threshold",
      () => setThreshold(next),
      () => setThreshold(prev),
    );
  };

  const toggleMto = (next: boolean) => {
    // Turning MTO on without a lead time would be rejected server-side; default
    // to 7 days so the quick toggle succeeds (the founder can refine on the form).
    const nextLead = next && (lead ?? 0) < 1 ? 7 : lead ?? undefined;
    const prevMto = mto;
    persist(
      {
        id: row.id,
        mode: "set",
        value: qty,
        reason: "correction",
        madeToOrder: next,
        ...(next ? { productionLeadTimeDays: nextLead } : {}),
      },
      "mto",
      () => setMto(next),
      () => setMto(prevMto),
    );
  };

  return (
    <AdminTableRow>
      <AdminTableCell className="max-md:hidden w-14">
        <Thumb url={row.thumbnailUrl} alt={row.title} />
      </AdminTableCell>
      <AdminTableCell label="Product">
        <Link
          href={`/admin/products/${row.id}/edit`}
          className="flex items-center gap-3 font-medium text-foreground hover:text-primary"
        >
          <span className="md:hidden">
            <Thumb url={row.thumbnailUrl} alt={row.title} />
          </span>
          <span className="min-w-0">
            <span className="block truncate">{row.title}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{row.sku}</span>
          </span>
        </Link>
      </AdminTableCell>
      <AdminTableCell label="State">
        <StatusBadge tone={meta.tone} label={meta.label} />
      </AdminTableCell>
      <AdminTableCell label="Qty">
        {mto ? (
          <span className="text-sm text-muted-foreground">n/a</span>
        ) : (
          <div className="relative inline-flex items-center">
            <AdminInput
              aria-label={`Quantity for ${row.title}`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={qtyDraft}
              onChange={(e) => setQtyDraft(e.target.value)}
              onBlur={commitQty}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="h-9 w-20 text-center"
            />
            {savingField === "qty" ? (
              <Loader2 className="ml-1 size-3.5 animate-spin text-muted-foreground" aria-hidden />
            ) : null}
          </div>
        )}
      </AdminTableCell>
      <AdminTableCell label="Low ≤">
        {mto ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <AdminInput
            aria-label={`Low-stock threshold for ${row.title}`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={thresholdDraft}
            onChange={(e) => setThresholdDraft(e.target.value)}
            onBlur={commitThreshold}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-9 w-16 text-center"
          />
        )}
      </AdminTableCell>
      <AdminTableCell label="Made to order">
        <Switch
          aria-label={`Made to order for ${row.title}`}
          checked={mto}
          onCheckedChange={toggleMto}
          disabled={savingField === "mto"}
        />
      </AdminTableCell>
      <AdminTableCell label="Lead">
        <span className="text-sm text-muted-foreground">{mto && lead ? `${lead}d` : "—"}</span>
      </AdminTableCell>
      <AdminTableCell label="Adjust" className="max-md:justify-end">
        <AdjustSheet
          row={row}
          currentQty={qty}
          expectedUpdatedAt={updatedAt}
          onApplied={(data, token) => {
            setQty(data.inventoryQuantity);
            setThreshold(data.lowStockThreshold);
            setMto(data.madeToOrder);
            setLead(data.productionLeadTimeDays);
            setQtyDraft(String(data.inventoryQuantity));
            setThresholdDraft(String(data.lowStockThreshold));
            setUpdatedAt(token);
          }}
        />
      </AdminTableCell>
    </AdminTableRow>
  );
}

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        <Package className="size-4" aria-hidden />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="size-10 rounded-lg border border-border object-cover" />;
}

/** The reasoned-adjustment sheet (set / delta + required reason → AuditLog). */
function AdjustSheet({
  row,
  currentQty,
  expectedUpdatedAt,
  onApplied,
}: {
  row: InventoryRowData;
  currentQty: number;
  expectedUpdatedAt: string;
  onApplied: (
    data: {
      inventoryQuantity: number;
      lowStockThreshold: number;
      madeToOrder: boolean;
      productionLeadTimeDays: number | null;
    },
    token: string,
  ) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"set" | "delta">("delta");
  const [value, setValue] = React.useState("");
  const [reason, setReason] = React.useState<AdjustReason>("received_stock");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const parsedValue = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsedValue);
  const preview = !valid
    ? currentQty
    : mode === "set"
      ? Math.max(0, parsedValue)
      : Math.max(0, currentQty + parsedValue);

  const submit = async () => {
    if (!valid) return;
    setPending(true);
    const res = await adjustInventory({
      id: row.id,
      mode,
      value: Math.trunc(parsedValue),
      reason,
      note: note.trim() || undefined,
      expectedUpdatedAt,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onApplied(res.data, new Date().toISOString());
    toast.success("Stock updated.");
    setOpen(false);
    setValue("");
    setNote("");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Adjust stock for ${row.title}`}
      >
        <SlidersHorizontal className="size-4" />
        Adjust
      </Button>
      <SheetContent side="right" className="w-full max-w-md">
        <SheetHeader>
          <SheetTitle className="font-serif">Adjust stock</SheetTitle>
          <SheetDescription>{row.title}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          {/* Mode toggle: set absolute vs +/- delta */}
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Adjustment mode">
            <ModeButton active={mode === "delta"} onClick={() => setMode("delta")}>
              Add / remove (±)
            </ModeButton>
            <ModeButton active={mode === "set"} onClick={() => setMode("set")}>
              Set to…
            </ModeButton>
          </div>

          <FormField label={mode === "set" ? "New quantity" : "Change by (use - to remove)"}>
            <AdminInput
              type="number"
              inputMode="numeric"
              step={1}
              min={mode === "set" ? 0 : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "set" ? "e.g. 5" : "e.g. +3 or -2"}
              autoFocus
            />
          </FormField>

          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">New stock will be </span>
            <span className="font-semibold text-foreground">{preview}</span>
            <span className="text-muted-foreground"> (was {currentQty})</span>
          </p>

          <FormField label="Reason" required>
            <AdminSelect value={reason} onChange={(e) => setReason(e.target.value as AdjustReason)}>
              {ADJUST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
            </AdminSelect>
          </FormField>

          <FormField label="Note" hint="Optional — a short explanation for the history.">
            <AdminTextarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
          </FormField>
        </div>

        <SheetFooter>
          <Button type="button" onClick={submit} disabled={!valid || pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save adjustment
          </Button>
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
