/**
 * Admin UI kit barrel — the CONTRACT surface feature agents import as
 * `@/components/admin`. Re-exports every shared admin component + the nav model.
 * (Importing the specific file also works; this barrel is for convenience.)
 */

// Layout & structure (RSC)
export { AdminPageHeader } from "./page-header";
export { Panel } from "./panel";
export { Toolbar } from "./toolbar";
export { EmptyState } from "./empty-state";

// Table (RSC, responsive → cards on mobile)
export {
  AdminTable,
  AdminTableHeader,
  AdminTableHead,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
} from "./admin-table";

// Status & pagination
export { StatusBadge } from "./status-badge";
export { AdminPagination } from "./admin-pagination";

// Forms (RSC-friendly primitives)
export {
  FormField,
  AdminLabel,
  AdminInput,
  AdminTextarea,
  AdminSelect,
} from "./form-field";

// Interactive leaves (client)
export { SubmitButton } from "./submit-button";
export { ConfirmButton } from "./confirm-button";
export { SearchInput } from "./search-input";

// Shell + nav model (mounted by the admin layout)
export { AdminShell, type AdminShellAdmin } from "./admin-shell";
export {
  ADMIN_NAV,
  navForRole,
  type AdminNavItem,
  type AdminNavGroup,
  type NavBadgeCounts,
} from "./nav-config";
