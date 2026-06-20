import Link from "next/link";
import type { ReactNode } from "react";
import { Search, Phone } from "lucide-react";
import { getNavData } from "@/lib/services/content";
import { getSiteSettings } from "@/lib/services/settings";
import { CartButton } from "@/components/cart/cart-button";
import { MobileMenu } from "./mobile-menu";
import { Container } from "@/components/storefront/container";
import { Button } from "@/components/ui/button";

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-pastel-pink/20"
    >
      {children}
    </Link>
  );
}

export async function SiteHeader() {
  const [nav, settings] = await Promise.all([getNavData(), getSiteSettings()]);
  const storeName = settings?.storeName ?? "GooglyWoogly Art";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label={storeName} className="font-serif text-xl font-bold md:text-2xl">
          <span className="text-primary">Googly</span>
          <span className="text-foreground">Woogly</span>
          <span className="text-pastel-yellow">.</span>
          <span className="text-pastel-mint">Art</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          <NavLink href="/products">Shop All</NavLink>
          {nav.categories.length > 0 && (
            <div className="group relative">
              <button className="rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-pastel-pink/20">
                Categories
              </button>
              <div className="invisible absolute left-0 top-full z-10 w-56 rounded-2xl border border-border bg-card p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {nav.categories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/category/${c.slug}`}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-pastel-pink/20"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {nav.collections.slice(0, 2).map((c) => (
            <NavLink key={c.slug} href={`/collections/${c.slug}`}>
              {c.title}
            </NavLink>
          ))}
          <NavLink href="/bulk-orders">Bulk Orders</NavLink>
          <NavLink href="/about">About</NavLink>
        </nav>

        <div className="flex items-center gap-1">
          <Button
            asChild
            size="sm"
            className="mr-1 hidden rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90 md:inline-flex"
          >
            <Link href="/contact">
              <Phone className="mr-2 size-4" />
              Order Now
            </Link>
          </Button>
          <Link
            href="/search"
            aria-label="Search"
            className="inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-pastel-pink/30"
          >
            <Search className="size-5" />
          </Link>
          <CartButton />
          <MobileMenu categories={nav.categories} collections={nav.collections} />
        </div>
      </Container>
    </header>
  );
}
