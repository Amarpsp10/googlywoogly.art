/**
 * Default content outlines (doc 15 §7.2) inserted by the editor's "Insert
 * standard template" affordance when a page body is empty (FR-37). These are
 * **starting drafts**, not legal advice — legal pages carry a review gate. Stored
 * as plain HTML (h2/p/ul) which the server sanitizer accepts as-is.
 *
 * Bracketed tokens (e.g. `[whatsappNumber]`) are placeholders the founder fills
 * from their Settings values.
 */

export const CMS_TEMPLATES: Record<string, string> = {
  about: `<p>Handmade gifting and home décor, designed and crafted in Jaipur.</p>
<h2>Our story</h2>
<p>A note from Vanshika on why GooglyWoogly exists and the joy of handmade.</p>
<h2>Each piece is unique</h2>
<p>Small imperfections are part of the character of a handcrafted piece.</p>
<h2>Made to order</h2>
<p>What made-to-order means and typical lead times.</p>
<h2>How ordering works</h2>
<p>Browse, add to cart, place your request — we confirm and take payment on WhatsApp, then craft and ship.</p>`,

  contact: `<p>We'd love to hear from you. We usually reply within 24–48 hours on business days (IST).</p>
<h2>WhatsApp</h2>
<p>Chat with us: [whatsappNumber]</p>
<h2>Email</h2>
<p>[contactEmail]</p>
<h2>Address</h2>
<p>[businessAddress]</p>
<h2>Grievance / support</h2>
<p>For complaints, contact our grievance officer (see our Privacy Policy).</p>`,

  faq: `<p>Quick answers to the questions we hear most. Still stuck? Message us on WhatsApp.</p>`,

  "shipping-policy": `<h2>Where we ship</h2>
<p>We ship pan-India. International orders are handled via bulk enquiry only.</p>
<h2>Processing time</h2>
<p>In-stock items dispatch within a few business days; made-to-order lead times are shown on each product page.</p>
<h2>Shipping charges</h2>
<p>Flat ₹[flatRate], free over ₹[freeShippingThreshold].</p>
<h2>Tracking</h2>
<p>We share your tracking number on WhatsApp and email; track via your order link.</p>`,

  "returns-and-refunds": `<h2>Cancellations</h2>
<p>Cancel before dispatch — or before production begins for made-to-order items — via WhatsApp ([whatsappNumber]).</p>
<h2>Refunds</h2>
<p>Refunds are coordinated directly (UPI/bank) within 5–7 business days of approval.</p>
<h2>Made-to-order & personalized items</h2>
<p>Non-cancellable once production begins and non-returnable unless damaged.</p>
<h2>Damaged or wrong items</h2>
<p>Report within a few days with unboxing photos for a replacement or refund.</p>`,

  "privacy-policy": `<h2>Who we are</h2>
<p>GooglyWoogly Art, [businessAddress]. Contact: [contactEmail].</p>
<h2>Data we collect</h2>
<p>Name, phone, email, shipping/billing address, order details, and optional gift/personalization notes; plus minimal first-party analytics.</p>
<h2>Why we collect it</h2>
<p>To process and fulfil your order, coordinate payment/delivery on WhatsApp, send transactional updates, and comply with law — on a consent basis.</p>
<h2>Your rights</h2>
<p>You can request access, correction, or erasure, and withdraw consent. Contact our grievance officer.</p>
<h2>Changes</h2>
<p>We'll note the last-updated date here.</p>`,

  terms: `<h2>Ordering model</h2>
<p>The site captures an intent to order; no payment is taken on-site. We confirm availability and collect payment/coordinate on WhatsApp. An order is binding only once confirmed.</p>
<h2>Pricing & availability</h2>
<p>Prices are in ₹ (INR). Handmade items may vary slightly; we may correct errors or cancel an order (e.g. mispricing, out of stock).</p>
<h2>Intellectual property</h2>
<p>Site content, photos, and designs © GooglyWoogly Art.</p>
<h2>Governing law</h2>
<p>India; courts at Jaipur, Rajasthan.</p>`,

  "care-guide": `<p>Treat your piece like the one-of-a-kind handmade item it is.</p>
<h2>General care</h2>
<p>Keep away from harsh sunlight, moisture, and heat. Small variations are normal.</p>
<h2>By material</h2>
<p>Ceramics, wood, brass, textiles, resin, and hand-painted pieces each have specific tips — see your product page.</p>`,

  "bulk-orders": `<p>Handmade corporate and festive gifting, personalised for your team or clients, delivered pan-India.</p>
<h2>What we offer</h2>
<p>Custom branding, festive hampers, and employee/client gifting.</p>
<h2>How it works</h2>
<p>Tell us about your requirement below and we'll quote on WhatsApp.</p>`,
};

export function templateFor(slug: string): string | undefined {
  return CMS_TEMPLATES[slug];
}
