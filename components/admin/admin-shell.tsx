"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ExternalLink, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, type AdminRole } from "@/lib/auth/types";
import {
  navForRole,
  type AdminNavGroup,
  type AdminNavItem,
  type NavBadgeCounts,
} from "./nav-config";
import { LogoutButton } from "./logout-button";

/**
 * `AdminShell` — the responsive frame every `app/admin/*` page renders into
 * (doc 10 FR-31/32/33, §4.1). A collapsible left sidebar (off-canvas `Sheet`
 * drawer on mobile, persistent rail on desktop) + a sticky topbar (store name,
 * View store, admin name/role, sign-out). Phone-first: the founder runs this
 * from a phone, so touch targets are ≥44px and the nav is one tap away.
 *
 * Role-gated nav (defense-in-depth — server `requireRole()` is the real gate):
 * owner-only/non-staff items are filtered out of the menu for the current role.
 */

export interface AdminShellAdmin {
  name: string;
  email: string;
  role: AdminRole;
}

export function AdminShell({
  admin,
  storeName = "GooglyWoogly",
  badges,
  children,
}: {
  admin: AdminShellAdmin;
  storeName?: string;
  badges?: NavBadgeCounts;
  children: React.ReactNode;
}) {
  const groups = React.useMemo(() => navForRole(admin.role), [admin.role]);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on navigation.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background">
      {/* Skip link (a11y, doc 10 §8). */}
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <BrandHeader storeName={storeName} />
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin">
          <NavGroups groups={groups} badges={badges} pathname={pathname} />
        </nav>
        <ViewStore />
      </aside>

      {/* Topbar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/80 px-3 backdrop-blur lg:pl-[16rem]">
        {/* Mobile menu trigger + drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="flex size-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted lg:hidden"
            >
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[17rem] gap-0 bg-sidebar p-0">
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <BrandHeader storeName={storeName} />
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin">
              <NavGroups groups={groups} badges={badges} pathname={pathname} />
            </nav>
            <ViewStore />
          </SheetContent>
        </Sheet>

        <Link
          href="/admin"
          className="font-serif text-base font-bold text-foreground lg:hidden"
        >
          {storeName}
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
          >
            <ExternalLink className="size-4" />
            View store
          </a>
          <AccountMenu admin={admin} />
        </div>
      </header>

      {/* Content */}
      <main
        id="admin-content"
        className="px-4 py-5 sm:px-6 sm:py-6 lg:pl-[16.5rem]"
      >
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

function BrandHeader({ storeName }: { storeName: string }) {
  return (
    <Link
      href="/admin"
      className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="size-4" />
      </span>
      <span className="font-serif text-base font-bold text-sidebar-foreground">
        {storeName}
      </span>
      <span className="text-xs font-medium text-muted-foreground">Admin</span>
    </Link>
  );
}

function NavGroups({
  groups,
  badges,
  pathname,
}: {
  groups: AdminNavGroup[];
  badges?: NavBadgeCounts;
  pathname: string;
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={isActive(pathname, item.href)} badges={badges} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function NavLink({
  item,
  active,
  badges,
}: {
  item: AdminNavItem;
  active: boolean;
  badges?: NavBadgeCounts;
}) {
  const Icon = item.icon;
  const count = item.badge ? badges?.[item.badge] : undefined;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/15 text-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/40",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className="flex-1 truncate">{item.label}</span>
      {typeof count === "number" && count > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.7rem] font-semibold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function ViewStore() {
  return (
    <div className="border-t border-sidebar-border p-3">
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/40 hover:text-foreground"
      >
        <ExternalLink className="size-4" />
        View store
      </a>
    </div>
  );
}

function AccountMenu({ admin }: { admin: AdminShellAdmin }) {
  const initials = getInitials(admin.name);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 transition-colors hover:bg-muted"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
            {initials}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight text-foreground">
              {admin.name}
            </span>
            <span className="block text-xs leading-tight text-muted-foreground">
              {ROLE_LABEL[admin.role]}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{admin.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {admin.email}
          </span>
          <span className="mt-1 inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
            {ROLE_LABEL[admin.role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            View store
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Logout posts a Server Action; render outside the menu-item click. */}
        <div className="px-1 py-0.5">
          <LogoutButton />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Active when the path equals the href, or is a sub-path (but `/admin` is exact). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
