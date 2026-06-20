"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronRight, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn } from "@/lib/utils";
import { reorderCategories } from "./actions";
import { CategoryRowActions, type ReassignOption } from "./category-row-actions";

/**
 * Interactive category tree (docs/11 §4.5). Renders top-level categories with
 * their one-level children, each as a key:value-friendly row. Ordering is
 * **keyboard-accessible** via up/down controls (no drag dependency yet, per
 * docs/11 OQ-7 — a non-drag fallback is required regardless): moving a row
 * reorders it within its sibling group and persists a dense `sortOrder` via
 * `reorderCategories`. Each row carries the guarded Edit/Delete actions.
 */

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  productCount: number;
  children: CategoryNode[];
}

export function CategoryTree({
  categories,
  reassignOptions,
}: {
  categories: CategoryNode[];
  reassignOptions: ReassignOption[];
}) {
  const router = useRouter();
  const [tree, setTree] = React.useState(categories);
  const [pending, startTransition] = React.useTransition();

  // Re-sync if the server data changes (e.g. after a refresh post-mutation).
  React.useEffect(() => setTree(categories), [categories]);

  /** Persist a flat dense order for the affected sibling group. */
  const persist = React.useCallback(
    (orders: { id: string; sortOrder: number; parentId?: string | null }[]) => {
      startTransition(async () => {
        const result = await reorderCategories({ orders });
        if (!result.ok) {
          toast.error(result.error);
          setTree(categories); // revert optimistic move
          router.refresh();
          return;
        }
        router.refresh();
      });
    },
    [categories, router],
  );

  /** Move a top-level category up/down among its peers. */
  function moveParent(index: number, dir: -1 | 1) {
    const next = [...tree];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setTree(next);
    persist(next.map((c, i) => ({ id: c.id, sortOrder: i, parentId: null })));
  }

  /** Move a child within its parent's children. */
  function moveChild(parentIndex: number, childIndex: number, dir: -1 | 1) {
    const next = tree.map((c) => ({ ...c, children: [...c.children] }));
    const siblings = next[parentIndex].children;
    const target = childIndex + dir;
    if (target < 0 || target >= siblings.length) return;
    [siblings[childIndex], siblings[target]] = [siblings[target], siblings[childIndex]];
    setTree(next);
    const parentId = next[parentIndex].id;
    persist(siblings.map((c, i) => ({ id: c.id, sortOrder: i, parentId })));
  }

  if (tree.length === 0) return null;

  return (
    <ul className={cn("space-y-2", pending && "pointer-events-none opacity-70")}>
      {tree.map((parent, pi) => (
        <li key={parent.id}>
          <CategoryRow
            node={parent}
            depth={0}
            canUp={pi > 0}
            canDown={pi < tree.length - 1}
            onUp={() => moveParent(pi, -1)}
            onDown={() => moveParent(pi, 1)}
            reassignOptions={reassignOptions}
          />
          {parent.children.length > 0 ? (
            <ul className="mt-2 space-y-2 border-l border-border pl-3 sm:pl-5">
              {parent.children.map((child, ci) => (
                <li key={child.id}>
                  <CategoryRow
                    node={child}
                    depth={1}
                    canUp={ci > 0}
                    canDown={ci < parent.children.length - 1}
                    onUp={() => moveChild(pi, ci, -1)}
                    onDown={() => moveChild(pi, ci, 1)}
                    reassignOptions={reassignOptions}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CategoryRow({
  node,
  depth,
  canUp,
  canDown,
  onUp,
  onDown,
  reassignOptions,
}: {
  node: CategoryNode;
  depth: 0 | 1;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  reassignOptions: ReassignOption[];
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm sm:gap-3 sm:px-4",
      )}
    >
      <div className="flex shrink-0 flex-col" aria-hidden>
        <GripVertical className="size-4 text-muted-foreground/60" />
      </div>

      {/* Reorder controls (keyboard-accessible non-drag fallback). */}
      <div className="flex shrink-0 items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onUp}
          disabled={!canUp}
          aria-label={`Move ${node.name} up`}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDown}
          disabled={!canDown}
          aria-label={`Move ${node.name} down`}
        >
          <ArrowDown className="size-4" />
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {depth === 1 ? (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{node.name}</p>
          <p className="truncate text-xs text-muted-foreground">/{node.slug}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge
          tone={node.isActive ? "success" : "neutral"}
          label={node.isActive ? "Active" : "Hidden"}
        />
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {node.productCount} {node.productCount === 1 ? "product" : "products"}
        </span>
      </div>

      <CategoryRowActions
        id={node.id}
        name={node.name}
        productCount={node.productCount}
        reassignOptions={reassignOptions}
      />
    </div>
  );
}
