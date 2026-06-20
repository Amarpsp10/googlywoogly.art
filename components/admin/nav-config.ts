import type { AdminRole } from "@prisma/client";
import {
  LayoutDashboard,
  LineChart,
  Package,
  Boxes,
  FolderTree,
  Layers,
  ShoppingBag,
  Users,
  Briefcase,
  MessagesSquare,
  Star,
  Home,
  Image as ImageIcon,
  GalleryHorizontalEnd,
  Quote,
  HelpCircle,
  FileText,
  Settings,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

/**
 * Admin navigation model — the single source of truth for the sidebar groups
 * (doc 10 FR-32, §4.4) and their role gating (doc 10 §5.4). Both the desktop
 * rail and the mobile drawer render from this list; the command palette can
 * reuse it for permission-aware "Go to" navigation.
 *
 * `roles` is the set of roles allowed to *see* the item. Omit it (or set
 * `undefined`) for "all roles". Server-side `requireRole()` is still the real
 * gate — this only controls visibility (defense-in-depth).
 */

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Roles allowed to see this item; undefined ⇒ all admins. */
  roles?: readonly AdminRole[];
  /** Optional badge key the shell resolves to a live count. */
  badge?: "pendingOrders" | "lowStock" | "newInquiries" | "newMessages" | "pendingReviews";
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

const NON_STAFF: readonly AdminRole[] = ["owner", "admin"];
const OWNER_ONLY: readonly AdminRole[] = ["owner"];

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Analytics", href: "/admin/analytics", icon: LineChart },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Inventory", href: "/admin/inventory", icon: Boxes, badge: "lowStock" },
      { label: "Categories", href: "/admin/categories", icon: FolderTree, roles: NON_STAFF },
      { label: "Collections", href: "/admin/collections", icon: Layers, roles: NON_STAFF },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Orders", href: "/admin/orders", icon: ShoppingBag, badge: "pendingOrders" },
      { label: "Customers", href: "/admin/customers", icon: Users },
    ],
  },
  {
    label: "Leads",
    items: [
      {
        label: "Bulk Inquiries",
        href: "/admin/bulk-inquiries",
        icon: Briefcase,
        badge: "newInquiries",
      },
      {
        label: "Messages",
        href: "/admin/messages",
        icon: MessagesSquare,
        badge: "newMessages",
      },
      { label: "Reviews", href: "/admin/reviews", icon: Star, roles: NON_STAFF, badge: "pendingReviews" },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Homepage", href: "/admin/content", icon: Home, roles: NON_STAFF },
      { label: "Banners", href: "/admin/content?tab=banners", icon: GalleryHorizontalEnd, roles: NON_STAFF },
      { label: "Testimonials", href: "/admin/content?tab=testimonials", icon: Quote, roles: NON_STAFF },
      { label: "FAQ", href: "/admin/content?tab=faq", icon: HelpCircle, roles: NON_STAFF },
      { label: "Pages", href: "/admin/content?tab=pages", icon: FileText, roles: NON_STAFF },
      { label: "Settings", href: "/admin/settings", icon: Settings, roles: NON_STAFF },
      { label: "Media", href: "/admin/media", icon: ImageIcon },
    ],
  },
  {
    label: "System",
    items: [{ label: "Audit Log", href: "/admin/audit-log", icon: ScrollText, roles: OWNER_ONLY }],
  },
];

/** Filter the nav to the items a given role may see. */
export function navForRole(role: AdminRole): AdminNavGroup[] {
  return ADMIN_NAV.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

/** Counts the shell resolves for the sidebar/topbar badges (doc 10 FR-32). */
export interface NavBadgeCounts {
  pendingOrders?: number;
  lowStock?: number;
  newInquiries?: number;
  newMessages?: number;
  pendingReviews?: number;
}
