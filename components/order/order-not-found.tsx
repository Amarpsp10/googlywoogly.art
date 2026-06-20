import Link from "next/link";
import { MessageCircle, SearchX } from "lucide-react";
import { Container } from "@/components/storefront/container";
import { EmptyState } from "@/components/storefront/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Generic "we couldn't find that order" view (`08` FR-40 / `12` FR-32). Rendered
 * at HTTP 200 from the same route as a found order so an invalid token reveals
 * **no** existence oracle (it must not 404-vs-200). Offers WhatsApp + contact so
 * the buyer can still reach the founder.
 */
export function OrderNotFound({
  whatsappLink,
}: {
  /** Pre-built `wa.me` link, or "" to hide the WhatsApp CTA (no number configured). */
  whatsappLink: string;
}) {
  return (
    <Container as="main" className="py-16 md:py-24">
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<SearchX className="size-7" />}
          title="We couldn't find that order"
          message="This link may be incomplete or expired. Please double-check it, or reach out and we'll happily help you find your order."
          action={
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              {whatsappLink && (
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-[#25D366] text-white hover:bg-[#1ebe5d]"
                >
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-5" aria-hidden />
                    Chat with us on WhatsApp
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="rounded-full">
                <Link href="/contact">Contact us</Link>
              </Button>
            </div>
          }
        />
      </div>
    </Container>
  );
}
