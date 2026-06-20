import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Responsive admin table building blocks. On `md+` these render a normal table;
 * below `md` each row collapses to a stacked **key:value card** (doc 10 FR-36,
 * `03` §4 "Mobile-first admin").
 *
 * The collapse is pure CSS so it works in RSC with zero JS:
 *  - `<AdminTable>` wraps everything.
 *  - On mobile every `<AdminTableRow>` becomes a bordered card and each
 *    `<AdminTableCell label="…">` shows its `label` (the column header) as a
 *    left-aligned key beside the value. The `<thead>` is visually hidden on
 *    mobile.
 *
 * Usage:
 *   <AdminTable>
 *     <AdminTableHeader>
 *       <AdminTableHead>Order</AdminTableHead>
 *       <AdminTableHead>Status</AdminTableHead>
 *     </AdminTableHeader>
 *     <AdminTableBody>
 *       <AdminTableRow>
 *         <AdminTableCell label="Order">GW-2026-00042</AdminTableCell>
 *         <AdminTableCell label="Status"><StatusBadge … /></AdminTableCell>
 *       </AdminTableRow>
 *     </AdminTableBody>
 *   </AdminTable>
 */

export function AdminTable({
  children,
  className,
  caption,
}: {
  children: ReactNode;
  className?: string;
  caption?: string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn(
          "w-full border-collapse text-sm",
          // On mobile the table/row/cell display as blocks (card layout).
          "max-md:block",
          className,
        )}
      >
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function AdminTableHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    // Visually hidden on mobile; the per-cell `label` carries the header there.
    <thead className={cn("max-md:sr-only", className)}>
      <tr className="border-b border-border text-left">{children}</tr>
    </thead>
  );
}

export function AdminTableHead({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function AdminTableBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tbody className={cn("max-md:block max-md:space-y-3", className)}>{children}</tbody>;
}

export function AdminTableRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors last:border-0 hover:bg-muted/40",
        // Mobile: render the row as a self-contained card.
        "max-md:block max-md:rounded-2xl max-md:border max-md:p-3 max-md:shadow-sm max-md:last:border",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function AdminTableCell({
  children,
  label,
  className,
}: {
  children?: ReactNode;
  /** Column header — shown as the key on the mobile card layout. */
  label?: string;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-middle",
        // Mobile: each cell is a label/value row inside the card.
        "max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:px-0 max-md:py-1.5",
        className,
      )}
    >
      {label ? (
        <span className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground max-md:inline">
          {label}
        </span>
      ) : null}
      <span className="max-md:min-w-0 max-md:text-right">{children}</span>
    </td>
  );
}
