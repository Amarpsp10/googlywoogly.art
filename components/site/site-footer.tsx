import Link from "next/link";
import { Instagram, Facebook, Youtube } from "lucide-react";
import { getNavData } from "@/lib/services/content";
import { getSiteSettings } from "@/lib/services/settings";
import { Container } from "@/components/storefront/container";
import { NewsletterForm } from "./newsletter-form";
import type { SocialLinks } from "@/types";

const HELP_LINKS = [
  { href: "/faq", label: "FAQ" },
  { href: "/shipping-policy", label: "Shipping & Delivery" },
  { href: "/returns-and-refunds", label: "Returns & Refunds" },
  { href: "/bulk-orders", label: "Bulk & Corporate" },
  { href: "/contact", label: "Contact Us" },
];

const POLICY_LINKS = [
  { href: "/about", label: "Our Story" },
  { href: "/care-guide", label: "Care Guide" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
];

export async function SiteFooter() {
  const [nav, settings] = await Promise.all([getNavData(), getSiteSettings()]);
  const storeName = settings?.storeName ?? "GooglyWoogly Art";
  const social = (settings?.socialLinks as SocialLinks | null) ?? null;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-border bg-muted/30">
      <Container className="grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-serif text-xl font-bold text-primary">{storeName}</p>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Handmade gifts &amp; home décor, lovingly crafted in Jaipur. Each piece is one of a kind.
          </p>
          <div className="mt-4 flex gap-2">
            {social?.instagram && (
              <a href={social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex size-9 items-center justify-center rounded-full bg-card text-foreground transition hover:bg-pastel-pink/30">
                <Instagram className="size-4" />
              </a>
            )}
            {social?.facebook && (
              <a href={social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex size-9 items-center justify-center rounded-full bg-card text-foreground transition hover:bg-pastel-pink/30">
                <Facebook className="size-4" />
              </a>
            )}
            {social?.youtube && (
              <a href={social.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="flex size-9 items-center justify-center rounded-full bg-card text-foreground transition hover:bg-pastel-pink/30">
                <Youtube className="size-4" />
              </a>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-semibold">Shop</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/products" className="hover:text-primary">All Products</Link>
            </li>
            {nav.categories.slice(0, 5).map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="hover:text-primary">{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 font-semibold">Help</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {HELP_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-primary">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 font-semibold">Stay in the loop</h3>
          <p className="mb-3 text-sm text-muted-foreground">First dibs on new drops &amp; studio stories.</p>
          <NewsletterForm />
        </div>
      </Container>

      <div className="border-t border-border">
        <Container className="flex flex-col items-center justify-between gap-3 py-5 text-sm text-muted-foreground md:flex-row">
          <p>© {year} {storeName}. Handmade with ♥ in Jaipur.</p>
          <ul className="flex flex-wrap gap-4">
            {POLICY_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-primary">{l.label}</Link>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </footer>
  );
}
