import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible form primitives for admin forms (doc 10 §8 a11y). These are thin,
 * RSC-friendly wrappers over native controls styled with the theme tokens — they
 * work inside Server-Action `<form>`s without any client JS.
 *
 *  - `FormField` lays out a label, control, optional hint, and error, wiring
 *    `htmlFor`/`id`/`aria-describedby`/`aria-invalid` for the nested control via
 *    a context so the control doesn't need props repeated.
 *  - `AdminLabel`, `AdminInput`, `AdminTextarea`, `AdminSelect` are the controls.
 *
 * Pass `error` (a string) to `FormField` to surface a server validation message
 * (shape: `ActionResult.fieldErrors[name]?.[0]`).
 */

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

function useFieldControl() {
  return React.useContext(FieldContext);
}

function useFieldId(explicit?: string): string {
  const reactId = React.useId();
  return explicit ?? `fld-${reactId}`;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  /** Explicit id to bind label↔control; auto-generated when omitted. */
  htmlFor?: string;
  hint?: string;
  /** Server/client validation message; renders in the error region + sets aria-invalid. */
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useFieldId(htmlFor);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn("space-y-1.5", className)}>
        <AdminLabel htmlFor={id}>
          {label}
          {required ? (
            <span className="text-destructive" aria-hidden>
              {" "}
              *
            </span>
          ) : null}
        </AdminLabel>
        {children}
        {hint ? (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export function AdminLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "block text-sm font-medium leading-none text-foreground",
        className,
      )}
      {...props}
    />
  );
}

const CONTROL_BASE =
  "w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

/**
 * Bind the nearest `FormField`'s id/aria wiring onto a native control. Generic
 * over the control's prop type so spreading the result stays type-correct
 * (React's `aria-invalid` allows `"grammar"|"spelling"`, so we don't re-type it).
 */
function useControlProps<
  P extends {
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  },
>(props: P): P {
  const ctx = useFieldControl();
  if (!ctx) return props;
  return {
    ...props,
    id: props.id ?? ctx.id,
    "aria-describedby": props["aria-describedby"] ?? ctx.describedBy,
    "aria-invalid": props["aria-invalid"] ?? (ctx.invalid || undefined),
  };
}

export function AdminInput({
  className,
  type = "text",
  ...props
}: React.ComponentProps<"input">) {
  const bound = useControlProps(props);
  return (
    <input
      type={type}
      className={cn(CONTROL_BASE, "h-10", className)}
      {...bound}
    />
  );
}

export function AdminTextarea({
  className,
  rows = 4,
  ...props
}: React.ComponentProps<"textarea">) {
  const bound = useControlProps(props);
  return (
    <textarea
      rows={rows}
      className={cn(CONTROL_BASE, "min-h-20 resize-y", className)}
      {...bound}
    />
  );
}

/**
 * Native styled `<select>` — RSC/form-friendly (the shadcn Radix Select is a
 * client component and doesn't post a form value natively). Pass `<option>`s as
 * children, or an `options` array for convenience.
 */
export function AdminSelect({
  className,
  options,
  placeholder,
  children,
  ...props
}: React.ComponentProps<"select"> & {
  options?: readonly { value: string; label: string }[];
  placeholder?: string;
}) {
  const bound = useControlProps(props);
  return (
    <select
      className={cn(
        CONTROL_BASE,
        "h-10 appearance-none bg-[length:1rem] pr-9",
        className,
      )}
      {...bound}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        : children}
    </select>
  );
}
