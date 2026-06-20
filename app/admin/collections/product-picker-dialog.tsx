"use client";

import * as React from "react";
import { ImageIcon, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/money";
import type { ActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import type { AddableProduct } from "./actions";

/**
 * Product picker dialog for manual collection membership (docs/11 FR-61). Debounced
 * server search via the injected `search` action (active products, excluding
 * current members), multi-select with checkboxes, and an "Add selected" confirm.
 * Accessible: labelled search box, focus-trapped dialog, keyboard-operable rows.
 */

export function ProductPickerDialog({
  open,
  onOpenChange,
  excludeIds,
  onAdd,
  search,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[];
  onAdd: (products: AddableProduct[]) => void;
  search: (args: {
    query: string;
    excludeIds?: string[];
    limit?: number;
  }) => Promise<ActionResult<AddableProduct[]>>;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<AddableProduct[]>([]);
  const [selected, setSelected] = React.useState<Map<string, AddableProduct>>(new Map());
  const [loading, setLoading] = React.useState(false);

  // Reset selection each time the dialog opens; load an initial result set.
  React.useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    setQuery("");
  }, [open]);

  // Debounced search whenever the query (or open state) changes.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const result = await search({ query, excludeIds, limit: 30 });
      if (cancelled) return;
      setResults(result.ok ? result.data : []);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // excludeIds identity changes are fine to ignore; we snapshot at search time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  function toggle(product: AddableProduct) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(product.id)) next.delete(product.id);
      else next.set(product.id, product);
      return next;
    });
  }

  function confirm() {
    onAdd([...selected.values()]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b border-border p-4 sm:p-5">
          <DialogTitle className="font-serif">Add products</DialogTitle>
          <DialogDescription>
            Search active products by title or SKU, then add them to this collection.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border p-3 sm:p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className={cn(
                "h-10 w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground shadow-xs outline-none",
                "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "[&::-webkit-search-cancel-button]:appearance-none",
              )}
            />
          </div>
        </div>

        <div className="max-h-[45vh] min-h-32 overflow-y-auto p-2 sm:p-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {query ? "No matching products." : "No products available to add."}
            </p>
          ) : (
            <ul className="space-y-1" role="listbox" aria-label="Search results" aria-multiselectable>
              {results.map((p) => {
                const checked = selected.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(p)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors",
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border",
                          checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                        aria-hidden
                      >
                        {checked ? "✓" : ""}
                      </span>
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                        ) : (
                          <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {p.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.sku} · {formatPaise(p.price)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border p-3 sm:p-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={selected.size === 0}>
            Add {selected.size > 0 ? `${selected.size} ` : ""}
            {selected.size === 1 ? "product" : "products"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
