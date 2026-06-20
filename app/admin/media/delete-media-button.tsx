"use client";

import * as React from "react";
import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { deleteMedia } from "./actions";

/**
 * `DeleteMediaButton` — confirm + delete a media asset (doc 15 §5.2). Calls the
 * id-bound `deleteMedia` action, which refuses when the asset is still referenced
 * (surfaced as an error toast). Closes the dialog on completion.
 */
export function DeleteMediaButton({ id }: { id: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const res = await deleteMedia(id);
      if (res.ok) {
        toast.success("Media deleted.");
        setOpen(false);
      } else {
        toast.error(res.error || "Couldn't delete. Try again.");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Delete media"
          className="flex size-8 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm transition-colors hover:bg-destructive hover:text-white"
        >
          <Trash2 className="size-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif">Delete this media?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes it from your library. Assets still used by a product or banner
            can't be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className={cn("bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30")}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
