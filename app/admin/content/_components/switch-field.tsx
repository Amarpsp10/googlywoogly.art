"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * `SwitchField` — a labelled toggle for use **inside** a larger editor form. The
 * Radix `Switch` doesn't post a native form value, so this mirrors its state
 * into a hidden checkbox of the same `name` (the Server Action reads it via
 * `boolField`). Large tap target for one-handed phone use (doc 15 FR-2).
 */
export function SwitchField({
  name,
  label,
  description,
  defaultChecked = false,
  disabled,
  className,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [checked, setChecked] = React.useState(defaultChecked);
  const id = React.useId();

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {/* Hidden mirror so the value posts with the form. */}
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={setChecked}
        disabled={disabled}
        className="scale-125"
      />
    </div>
  );
}
