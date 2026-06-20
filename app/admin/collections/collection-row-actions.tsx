"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { deleteCollection } from "./actions";

/**
 * Per-row collection actions (docs/11 §4.6): an **Edit** link (Details + Members)
 * and a confirm-guarded **Delete**. Deleting removes the collection and its
 * membership rows (products are untouched).
 */
export function CollectionRowActions({
  id,
  title,
  memberCount,
}: {
  id: string;
  title: string;
  memberCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function runDelete() {
    startTransition(async () => {
      const result = await deleteCollection({ id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted "${title}".`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild variant="ghost" size="sm" className="min-h-9">
        <Link href={`/admin/collections/${id}/edit`}>
          <Pencil className="size-4" aria-hidden />
          <span className="max-sm:sr-only">Edit</span>
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="min-h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${title}`}
      >
        <Trash2 className="size-4" aria-hidden />
        <span className="max-sm:sr-only">Delete</span>
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberCount > 0
                ? `This removes the collection and unlinks its ${memberCount} product${memberCount === 1 ? "" : "s"}. The products themselves are kept. This cannot be undone.`
                : "This permanently removes the collection. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel type="button" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={runDelete}
              className="min-h-9"
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
