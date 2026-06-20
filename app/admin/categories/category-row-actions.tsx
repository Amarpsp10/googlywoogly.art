"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminSelect } from "@/components/admin/form-field";
import { cn } from "@/lib/utils";
import { deleteCategory } from "./actions";

/**
 * Per-row category actions (docs/11 §4.5): an **Edit** link and a guarded
 * **Delete**. Delete opens a confirm dialog; if the category still has products,
 * the action returns `blocked` and the dialog swaps to a "move products to …"
 * reassignment step (FR-58) before deleting. Empty categories delete directly.
 */

export interface ReassignOption {
  id: string;
  name: string;
}

export function CategoryRowActions({
  id,
  name,
  productCount,
  reassignOptions,
}: {
  id: string;
  name: string;
  productCount: number;
  /** Other categories products can be moved to when delete is blocked. */
  reassignOptions: ReassignOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  // When the guard fires we learn there are products to move; show the select.
  const [needsReassign, setNeedsReassign] = React.useState(productCount > 0);
  const [reassignToId, setReassignToId] = React.useState("");
  const [blockedCount, setBlockedCount] = React.useState(productCount);

  function reset() {
    setNeedsReassign(productCount > 0);
    setReassignToId("");
    setBlockedCount(productCount);
  }

  function runDelete() {
    startTransition(async () => {
      const result = await deleteCategory({
        id,
        reassignToId: reassignToId || undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (result.data.blocked) {
        // Switch into reassignment mode and keep the dialog open.
        setNeedsReassign(true);
        setBlockedCount(result.data.productCount);
        toast.info("Move the attached products before deleting this category.");
        return;
      }

      toast.success(`Deleted "${name}".`);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  const canSubmit = !pending && (!needsReassign || reassignToId.length > 0);

  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild variant="ghost" size="sm" className="min-h-9">
        <Link href={`/admin/categories/${id}/edit`}>
          <Pencil className="size-4" aria-hidden />
          <span className="max-sm:sr-only">Edit</span>
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="min-h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        aria-label={`Delete ${name}`}
      >
        <Trash2 className="size-4" aria-hidden />
        <span className="max-sm:sr-only">Delete</span>
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next) reset();
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              Delete “{name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {needsReassign
                ? `This category has ${blockedCount} product${blockedCount === 1 ? "" : "s"}. Choose a category to move ${blockedCount === 1 ? "it" : "them"} to, then delete.`
                : "This permanently removes the category. Any sub-categories become top-level. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {needsReassign ? (
            <div className="space-y-1.5">
              <label
                htmlFor={`reassign-${id}`}
                className="block text-sm font-medium text-foreground"
              >
                Move products to
              </label>
              <AdminSelect
                id={`reassign-${id}`}
                value={reassignToId}
                onChange={(e) => setReassignToId(e.target.value)}
              >
                <option value="" disabled>
                  Select a category…
                </option>
                {reassignOptions
                  .filter((o) => o.id !== id)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </AdminSelect>
            </div>
          ) : null}

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel type="button" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!canSubmit}
              aria-busy={pending || undefined}
              onClick={runDelete}
              className={cn("min-h-9")}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {needsReassign ? "Move & delete" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
