"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Sheet `close` is exposed via context (NOT a `children` render-prop) so that
 * **server** panels can render an editor form as a plain element child — passing
 * a function across the server→client boundary is illegal in RSC. The editor
 * forms read `close` with `useEditorSheetClose()`.
 */
const EditorSheetCloseContext = React.createContext<() => void>(() => {});

/** The enclosing `EditorSheet`'s close callback (no-op outside a sheet). */
export function useEditorSheetClose(): () => void {
  return React.useContext(EditorSheetCloseContext);
}

/**
 * `EditorSheet` — a mobile-first bottom sheet (full-height, scrollable) that
 * hosts a content editor form (doc 15 FR-2 "edit opens a full-height bottom
 * sheet"). It owns its open state and exposes a `close` callback to the rendered
 * form (via `useEditorSheetClose()`) so the form can dismiss the sheet from its
 * `onSuccess`.
 *
 * The `trigger` is either a provided node or a default "Add"/"Edit" button.
 */
export function EditorSheet({
  title,
  description,
  triggerLabel,
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerIcon = "edit",
  trigger,
  children,
  className,
}: {
  title: string;
  description?: string;
  triggerLabel: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  triggerIcon?: "add" | "edit" | "none";
  /** Custom trigger; overrides the default button. */
  trigger?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const Icon = triggerIcon === "add" ? Plus : Pencil;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant={triggerVariant} size={triggerSize} className="min-h-9">
            {triggerIcon !== "none" ? <Icon className="size-4" aria-hidden /> : null}
            {triggerLabel}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className={cn(
          "max-h-[92vh] overflow-y-auto rounded-t-2xl sm:mx-auto sm:max-w-2xl",
          className,
        )}
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="px-4 pb-8 sm:px-6">
          <EditorSheetCloseContext.Provider value={close}>
            {children}
          </EditorSheetCloseContext.Provider>
        </div>
      </SheetContent>
    </Sheet>
  );
}
