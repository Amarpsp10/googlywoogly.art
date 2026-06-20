import type { Metadata } from "next";
import { getShippingDefaults } from "@/lib/services/settings";
import { Container } from "@/components/storefront/container";
import { CartView } from "@/components/cart/cart-view";
import { buildMetadata } from "@/lib/seo/metadata";
import type { ShippingDefaults } from "@/types";

export const metadata: Metadata = buildMetadata({
  title: "Your Cart",
  path: "/cart",
  noindex: true,
});

export default async function CartPage() {
  const raw = (await getShippingDefaults()) as Partial<ShippingDefaults> | null;
  const shippingDefaults: ShippingDefaults = {
    flatRatePaise: raw?.flatRatePaise ?? 7900,
    freeShippingThresholdPaise: raw?.freeShippingThresholdPaise ?? 150000,
    codEnabled: raw?.codEnabled ?? false,
  };

  return (
    <Container as="main" className="py-8 md:py-12">
      <h1 className="mb-8 font-serif text-3xl font-bold md:text-4xl">Your Cart</h1>
      <CartView shippingDefaults={shippingDefaults} />
    </Container>
  );
}
