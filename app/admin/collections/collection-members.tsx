"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/admin/panel";
import { EmptyState } from "@/components/admin/empty-state";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  setCollectionProducts,
  searchAddableProducts,
  type AddableProduct,
} from "./actions";
import { ProductPickerDialog } from "./product-picker-dialog";

/**
 * Manual collection membership manager (docs/11 §4.6 Members, FR-61). Lets the
 * founder add/remove products and set the **merchandising order** shoppers see.
 * Ordering is keyboard-accessible via up/down controls (non-drag fallback per
 * OQ-7). A "set order automatically" helper sorts by bestseller → newest → price.
 * Saving replaces the set via `setCollectionProducts` (dense `sortOrder`).
 *
 * Local state is the source of truth while editing; a dirty indicator + explicit
 * Save keeps it predictable (no autosave on every nudge).
 */

export interface CollectionMember {
  id: string;
  title: string;
  sku: string;
  price: number;
  imageUrl: string | null;
  isBestseller: boolean;
  /** ISO timestamp — used by "set order automatically" (newest first). */
  createdAt: string;
}

export function CollectionMembers({
  collectionId,
  initialMembers,
}: {
  collectionId: string;
  initialMembers: CollectionMember[];
}) {
  const router = useRouter();
  const [members, setMembers] = React.useState<CollectionMember[]>(initialMembers);
  const [dirty, setDirty] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saving, startSaving] = React.useTransition();

  // Re-sync to server state when it changes (e.g. after a successful save+refresh).
  React.useEffect(() => {
    setMembers(initialMembers);
    setDirty(false);
  }, [initialMembers]);

  const memberIds = React.useMemo(() => members.map((m) => m.id), [members]);

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= members.length) return;
    const next = [...members];
    [next[index], next[target]] = [next[target], next[index]];
    setMembers(next);
    setDirty(true);
  }

  function remove(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setDirty(true);
  }

  function addProducts(picked: AddableProduct[]) {
    if (picked.length === 0) return;
    setMembers((prev) => {
      const have = new Set(prev.map((m) => m.id));
      const additions: CollectionMember[] = picked
        .filter((p) => !have.has(p.id))
        .map((p) => ({
          id: p.id,
          title: p.title,
          sku: p.sku,
          price: p.price,
          imageUrl: p.imageUrl,
          // Unknown from the picker; default so auto-sort still behaves sanely.
          isBestseller: false,
          createdAt: new Date(0).toISOString(),
        }));
      return [...prev, ...additions];
    });
    setDirty(true);
  }

  function autoSort() {
    const next = [...members].sort((a, b) => {
      if (a.isBestseller !== b.isBestseller) return a.isBestseller ? -1 : 1;
      const byNew = b.createdAt.localeCompare(a.createdAt);
      if (byNew !== 0) return byNew;
      return a.price - b.price;
    });
    setMembers(next);
    setDirty(true);
  }

  function save() {
    startSaving(async () => {
      const result = await setCollectionProducts({
        collectionId,
        items: members.map((m, i) => ({ productId: m.id, sortOrder: i })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Collection products saved.");
      setDirty(false);
      router.refresh();
    });
  }

  const action = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={autoSort}
        disabled={members.length < 2}
        className="min-h-9"
      >
        <Wand2 className="size-4" aria-hidden />
        Auto-order
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setPickerOpen(true)}
        className="min-h-9"
      >
        <Plus className="size-4" aria-hidden />
        Add products
      </Button>
    </div>
  );

  return (
    <Panel
      title="Members"
      description={`${members.length} product${members.length === 1 ? "" : "s"} · the order here is the order shoppers see`}
      action={action}
    >
      {members.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="size-6" />}
          title="No products yet"
          description="Add active products to build this collection. You control the order."
          action={
            <Button type="button" onClick={() => setPickerOpen(true)} className="rounded-full">
              <Plus className="size-4" aria-hidden />
              Add products
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {members.map((m, i) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-2.5 py-2 sm:px-3"
            >
              <div className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${m.title} up`}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => move(i, 1)}
                  disabled={i === members.length - 1}
                  aria-label={`Move ${m.title} down`}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>

              <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.imageUrl}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.sku} · {formatPaise(m.price)}
                </p>
              </div>

              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                #{i + 1}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(m.id)}
                aria-label={`Remove ${m.title}`}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p
          className={cn(
            "text-xs",
            dirty ? "font-medium text-foreground" : "text-muted-foreground",
          )}
          role="status"
          aria-live="polite"
        >
          {dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        <Button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          aria-busy={saving || undefined}
          className="min-h-11"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          Save order
        </Button>
      </div>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={memberIds}
        onAdd={addProducts}
        search={searchAddableProducts}
      />
    </Panel>
  );
}
