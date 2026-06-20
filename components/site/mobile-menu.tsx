"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

interface NavItem {
  slug: string;
  label: string;
  href: string;
}

export function MobileMenu({
  categories,
  collections,
}: {
  categories: { slug: string; name: string }[];
  collections: { slug: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);

  const catItems: NavItem[] = categories.map((c) => ({
    slug: c.slug,
    label: c.name,
    href: `/category/${c.slug}`,
  }));
  const colItems: NavItem[] = collections.map((c) => ({
    slug: c.slug,
    label: c.title,
    href: `/collections/${c.slug}`,
  }));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-full hover:bg-pastel-pink/30 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <nav className="absolute right-0 top-0 h-full w-72 overflow-y-auto bg-background p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-serif text-lg font-bold text-primary">Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-full p-2 hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-col gap-1" onClick={() => setOpen(false)}>
              <Link href="/products" className="rounded-lg px-3 py-2.5 font-medium hover:bg-pastel-pink/20">
                Shop All
              </Link>
              <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Categories
              </p>
              {catItems.map((c) => (
                <Link key={c.slug} href={c.href} className="rounded-lg px-3 py-2 text-sm hover:bg-pastel-pink/20">
                  {c.label}
                </Link>
              ))}
              {colItems.length > 0 && (
                <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Collections
                </p>
              )}
              {colItems.map((c) => (
                <Link key={c.slug} href={c.href} className="rounded-lg px-3 py-2 text-sm hover:bg-pastel-pink/20">
                  {c.label}
                </Link>
              ))}
              <Link href="/bulk-orders" className="mt-3 rounded-lg px-3 py-2.5 font-medium hover:bg-pastel-pink/20">
                Bulk Orders
              </Link>
              <Link href="/about" className="rounded-lg px-3 py-2.5 font-medium hover:bg-pastel-pink/20">
                About
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
