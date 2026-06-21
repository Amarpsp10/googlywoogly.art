/**
 * Database seed — idempotent for dev.
 *
 * - Always upserts the singleton SiteSetting, the bootstrap admin, and email templates.
 * - In non-production, clears and re-creates the catalog + CMS content so the
 *   storefront has realistic data to render. Orders/customers are never touched.
 *
 * Run with:  pnpm prisma db seed   (loads .env automatically)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const img = (seed: string) => `https://picsum.photos/seed/${seed}/900/900`;

async function seedSettingsAndAdmin() {
  await prisma.siteSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      storeName: "GooglyWoogly Art",
      contactEmail: "googlywooglyarrtt@gmail.com",
      whatsappNumber: process.env.WHATSAPP_NUMBER ?? "916367851899",
      currency: "INR",
      socialLinks: { instagram: "https://instagram.com/googlywoogly_arrtt" },
      shippingDefaults: {
        flatRatePaise: 7900,
        freeShippingThresholdPaise: 150000,
        codEnabled: false,
      },
      defaultSeo: {
        titleTemplate: "%s · GooglyWoogly Art",
        defaultDescription:
          "Handmade gifts & home décor, lovingly crafted in Jaipur. Each piece is one of a kind.",
        twitterHandle: "@googlywoogly_arrtt",
      },
      announcementBar: {
        enabled: true,
        text: "Handmade in Jaipur ✦ Free shipping over ₹1,500 ✦ Pay easily on WhatsApp",
      },
      businessAddress: { legalName: "GooglyWoogly Art", city: "Jaipur", state: "Rajasthan", country: "IN" },
    },
  });

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "admin@googlywoogly.art";
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "ChangeMe!Admin123";
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: { name: "Vanshika Bhatia", email, passwordHash, role: "owner" },
  });

  const templates = [
    { key: "order_received_customer", subject: "We've received your order {{orderNumber}} 🎁", variables: ["orderNumber", "customerName"] },
    { key: "order_received_admin", subject: "New order {{orderNumber}}", variables: ["orderNumber"] },
    { key: "order_confirmed_customer", subject: "Your order {{orderNumber}} is confirmed", variables: ["orderNumber"] },
    { key: "order_shipped_customer", subject: "Your order {{orderNumber}} has shipped 🚚", variables: ["orderNumber", "trackingUrl"] },
    { key: "bulk_inquiry_ack", subject: "Thanks for your bulk enquiry", variables: ["name"] },
    { key: "contact_ack", subject: "We received your message", variables: ["name"] },
  ];
  for (const t of templates) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      update: { subject: t.subject, variables: t.variables },
      create: { ...t, htmlBody: "<p>{{body}}</p>" },
    });
  }
}

async function clearContent() {
  await prisma.collectionProduct.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.category.deleteMany();
  await prisma.homepageSection.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.faqItem.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.mediaAsset.deleteMany();
}

async function seedCatalog() {
  // Categories
  const categoryData = [
    { slug: "wall-decor", name: "Wall Décor", description: "Hand-painted plates, macramé, and statement pieces for your walls.", sortOrder: 1 },
    { slug: "tableware-dining", name: "Tableware & Dining", description: "Glazed ceramics and blue pottery for a table that tells a story.", sortOrder: 2 },
    { slug: "candles-fragrance", name: "Candles & Fragrance", description: "Hand-poured candles and brass diyas to warm any corner.", sortOrder: 3 },
    { slug: "personalized-gifts", name: "Personalized Gifts", description: "Made-to-order keepsakes, personalised just for them.", sortOrder: 4 },
  ];
  const categories: Record<string, string> = {};
  for (const c of categoryData) {
    const asset = await prisma.mediaAsset.create({ data: { url: img(`cat-${c.slug}`), alt: c.name, folder: "categories", width: 900, height: 900 } });
    const cat = await prisma.category.create({ data: { ...c, isActive: true, imageId: asset.id, metaTitle: `${c.name} · Handmade Gifts`, metaDescription: c.description } });
    categories[c.slug] = cat.id;
  }

  // Collections
  const collectionData = [
    { slug: "diwali-gifting", title: "Diwali Gifting", description: "Light up the festival with handmade gifts and décor.", isFeaturedOnHome: true, sortOrder: 1 },
    { slug: "bestsellers", title: "Bestsellers", description: "The pieces our customers love most.", isFeaturedOnHome: true, sortOrder: 2 },
    { slug: "under-999", title: "Gifts Under ₹999", description: "Thoughtful handmade gifts that won't break the bank.", isFeaturedOnHome: false, sortOrder: 3 },
  ];
  const collections: Record<string, string> = {};
  for (const c of collectionData) {
    const asset = await prisma.mediaAsset.create({ data: { url: img(`col-${c.slug}`), alt: c.title, folder: "collections", width: 1600, height: 900 } });
    const col = await prisma.collection.create({ data: { ...c, type: "manual", isActive: true, heroImageId: asset.id, metaTitle: `${c.title} · GooglyWoogly Art`, metaDescription: c.description } });
    collections[c.slug] = col.id;
  }

  // Products
  type P = {
    slug: string; title: string; subtitle: string; sku: string; price: number; compareAtPrice?: number;
    category: string; inventoryQuantity: number; madeToOrder?: boolean; productionLeadTimeDays?: number;
    allowsPersonalization?: boolean; personalizationLabel?: string; materials: string; care: string;
    occasions: string[]; tags: string[]; isFeatured?: boolean; isBestseller?: boolean; collections: string[];
    description: string; short: string;
  };
  const products: P[] = [
    {
      slug: "madhubani-hand-painted-wall-plate", title: "Madhubani Hand-Painted Wall Plate", subtitle: "Folk art for your walls",
      sku: "GW-WD-001", price: 149900, compareAtPrice: 199900, category: "wall-decor", inventoryQuantity: 12,
      materials: "MDF, acrylic paints, matte sealant", care: "Wipe gently with a dry cloth. Keep away from direct moisture.",
      occasions: ["Diwali", "Housewarming"], tags: ["madhubani", "folk-art", "wall-plate"], isFeatured: true, isBestseller: true,
      collections: ["bestsellers", "diwali-gifting"], short: "A hand-painted Madhubani plate, each stroke done by hand.",
      description: "<p>A 10-inch wall plate hand-painted in the traditional Madhubani style. No two are exactly alike — every line is drawn by hand in our Jaipur studio.</p>",
    },
    {
      slug: "brass-diya-set-of-5", title: "Brass Diya Set (Set of 5)", subtitle: "Hand-finished festive lamps",
      sku: "GW-CF-002", price: 89900, category: "candles-fragrance", inventoryQuantity: 30,
      materials: "Solid brass", care: "Polish with a brass cleaner to restore shine.",
      occasions: ["Diwali", "Karwa Chauth"], tags: ["brass", "diya", "festive"], isBestseller: true,
      collections: ["diwali-gifting", "bestsellers"], short: "Five hand-finished brass diyas for festive light.",
      description: "<p>A set of five solid-brass diyas, hand-finished to a warm glow. Beautiful for Diwali, pujas, and everyday corners.</p>",
    },
    {
      slug: "hand-glazed-ceramic-dinner-set", title: "Hand-Glazed Ceramic Dinner Set", subtitle: "Wheel-thrown, reactive glaze",
      sku: "GW-TD-003", price: 489900, compareAtPrice: 599900, category: "tableware-dining", inventoryQuantity: 4,
      materials: "Stoneware ceramic, food-safe reactive glaze", care: "Microwave & dishwasher safe. Hand-wash recommended to preserve the glaze.",
      occasions: ["Wedding", "Housewarming", "Anniversary"], tags: ["ceramic", "dinner-set", "stoneware"], isFeatured: true,
      collections: ["bestsellers"], short: "A wheel-thrown dinner set with a one-of-a-kind reactive glaze.",
      description: "<p>A four-piece dinner set, wheel-thrown and finished with a reactive glaze that makes every piece unique. Food-safe and built for everyday joy.</p>",
    },
    {
      slug: "personalized-wooden-name-keychain", title: "Personalized Wooden Name Keychain", subtitle: "Made to order, just for them",
      sku: "GW-PG-004", price: 39900, category: "personalized-gifts", inventoryQuantity: 0, madeToOrder: true, productionLeadTimeDays: 5,
      allowsPersonalization: true, personalizationLabel: "Name to engrave (max 10 characters)",
      materials: "Sheesham wood", care: "Keep dry; wipe with a soft cloth.",
      occasions: ["Birthday", "Anniversary"], tags: ["personalized", "keychain", "wood"],
      collections: ["under-999"], short: "A hand-engraved wooden keychain, personalised with any name.",
      description: "<p>Hand-engraved on sheesham wood with the name of your choice. Made to order in 5 days.</p>",
    },
    {
      slug: "terracotta-scented-candle-trio", title: "Terracotta Scented Candle Trio", subtitle: "Hand-poured soy wax",
      sku: "GW-CF-005", price: 79900, compareAtPrice: 99900, category: "candles-fragrance", inventoryQuantity: 18,
      materials: "Terracotta, soy wax, cotton wick", care: "Trim wick to 5mm before each burn.",
      occasions: ["Housewarming", "Birthday"], tags: ["candle", "soy-wax", "terracotta"], isBestseller: true,
      collections: ["under-999", "bestsellers"], short: "Three hand-poured soy candles in handmade terracotta pots.",
      description: "<p>A trio of soy-wax candles hand-poured into terracotta pots — sandalwood, rose, and vetiver.</p>",
    },
    {
      slug: "macrame-wall-hanging-large", title: "Macramé Wall Hanging (Large)", subtitle: "Knotted by hand",
      sku: "GW-WD-006", price: 199900, category: "wall-decor", inventoryQuantity: 2, madeToOrder: true, productionLeadTimeDays: 7,
      materials: "Recycled cotton cord, driftwood", care: "Dust gently; spot-clean only.",
      occasions: ["Housewarming", "Wedding"], tags: ["macrame", "boho", "wall-hanging"],
      collections: ["bestsellers"], short: "A large hand-knotted macramé hanging on natural driftwood.",
      description: "<p>Hand-knotted from recycled cotton cord on a piece of natural driftwood. Made to order in 7 days.</p>",
    },
    {
      slug: "blue-pottery-tea-cups-set-of-2", title: "Blue Pottery Tea Cups (Set of 2)", subtitle: "Jaipur's signature craft",
      sku: "GW-TD-007", price: 64900, category: "tableware-dining", inventoryQuantity: 3,
      materials: "Quartz blue pottery, food-safe glaze", care: "Hand-wash with mild soap.",
      occasions: ["Anniversary", "Birthday"], tags: ["blue-pottery", "jaipur", "tea-cups"],
      collections: ["under-999"], short: "Two hand-painted blue pottery cups — Jaipur's signature craft.",
      description: "<p>Hand-thrown and hand-painted in Jaipur's iconic blue pottery tradition. A pair made for slow chai mornings.</p>",
    },
    {
      slug: "personalized-couple-portrait", title: "Personalized Couple Portrait", subtitle: "Your story, hand-illustrated",
      sku: "GW-PG-008", price: 259900, category: "personalized-gifts", inventoryQuantity: 0, madeToOrder: true, productionLeadTimeDays: 10,
      allowsPersonalization: true, personalizationLabel: "Names + a short note for the artist",
      materials: "Archival paper, hand illustration", care: "Frame behind glass; avoid direct sunlight.",
      occasions: ["Anniversary", "Wedding"], tags: ["personalized", "portrait", "couple"], isFeatured: true,
      collections: [], short: "A hand-illustrated portrait, personalised to your story.",
      description: "<p>A bespoke, hand-illustrated portrait created from your photo and notes. Made to order in 10 days.</p>",
    },
  ];

  for (const p of products) {
    const primary = await prisma.mediaAsset.create({ data: { url: img(p.slug), alt: p.title, folder: "products", width: 900, height: 900 } });
    const second = await prisma.mediaAsset.create({ data: { url: img(`${p.slug}-2`), alt: `${p.title} — detail`, folder: "products", width: 900, height: 900 } });
    const product = await prisma.product.create({
      data: {
        slug: p.slug, title: p.title, subtitle: p.subtitle, sku: p.sku, price: p.price, compareAtPrice: p.compareAtPrice ?? null,
        description: p.description, shortDescription: p.short, status: "active", inventoryQuantity: p.inventoryQuantity,
        madeToOrder: p.madeToOrder ?? false, productionLeadTimeDays: p.productionLeadTimeDays ?? null, lowStockThreshold: 3,
        allowsPersonalization: p.allowsPersonalization ?? false, personalizationLabel: p.personalizationLabel ?? null,
        materials: p.materials, careInstructions: p.care, dimensions: { length: 25, width: 25, height: 5, unit: "cm" },
        weightGrams: 600, categoryId: categories[p.category], tags: p.tags, occasions: p.occasions,
        isFeatured: p.isFeatured ?? false, isBestseller: p.isBestseller ?? false, primaryImageId: primary.id, ogImageId: primary.id,
        publishedAt: new Date(), metaTitle: `${p.title} · GooglyWoogly Art`, metaDescription: p.short,
        images: {
          create: [
            { url: primary.url, alt: p.title, width: 900, height: 900, sortOrder: 0, isPrimary: true, mediaAssetId: primary.id },
            { url: second.url, alt: `${p.title} — detail`, width: 900, height: 900, sortOrder: 1, isPrimary: false, mediaAssetId: second.id },
          ],
        },
      },
    });
    for (const cslug of p.collections) {
      const collectionId = collections[cslug];
      if (collectionId) {
        await prisma.collectionProduct.create({ data: { collectionId, productId: product.id } });
      }
    }
  }

  return { categoryCount: categoryData.length, collectionCount: collectionData.length, productCount: products.length };
}

async function seedCms() {
  const sections = [
    { key: "hero", type: "hero" as const, sortOrder: 0, payload: { headline: "Handmade with heart, in Jaipur", sub: "One-of-a-kind gifts & home décor, crafted by hand and made to be treasured.", ctaLabel: "Shop the collection", ctaHref: "/products" } },
    { key: "category_grid", type: "category_grid" as const, sortOrder: 1, payload: { title: "Shop by category" } },
    { key: "featured_collections", type: "featured_collections" as const, sortOrder: 2, payload: { title: "Gifts for every occasion" } },
    { key: "bestsellers", type: "bestsellers" as const, sortOrder: 3, payload: { title: "Loved by our customers", collectionSlug: "bestsellers", limit: 8 } },
    { key: "story", type: "story" as const, sortOrder: 4, payload: { title: "Meet the maker", body: "Every piece is designed and crafted by Vanshika in her Jaipur studio." } },
    { key: "testimonials", type: "testimonials" as const, sortOrder: 5, payload: { title: "Kind words" } },
    { key: "newsletter", type: "newsletter" as const, sortOrder: 6, payload: { title: "First dibs on new drops", sub: "Join our list for new collections and studio stories." } },
    { key: "faq", type: "faq" as const, sortOrder: 7, payload: { title: "Frequently asked" } },
  ];
  for (const s of sections) {
    await prisma.homepageSection.create({ data: { key: s.key, type: s.type, sortOrder: s.sortOrder, isActive: true, payload: s.payload } });
  }

  const testimonials = [
    { customerName: "Aarav S.", location: "Mumbai", rating: 5, text: "The Madhubani plate is even more beautiful in person. You can feel it's handmade.", isFeatured: true, sortOrder: 0 },
    { customerName: "Priya K.", location: "Bengaluru", rating: 5, text: "Ordered the dinner set for a wedding gift — they were blown away. Vanshika was so helpful on WhatsApp.", isFeatured: true, sortOrder: 1 },
    { customerName: "Rohan M.", location: "Delhi", rating: 5, text: "My personalized portrait was perfect. Worth the wait!", isFeatured: false, sortOrder: 2 },
    { customerName: "Sneha R.", location: "Jaipur", rating: 5, text: "Beautiful candles, beautifully packed. Will order again.", isFeatured: true, sortOrder: 3 },
  ];
  for (const t of testimonials) {
    await prisma.testimonial.create({ data: { ...t, isApproved: true } });
  }

  const faqs = [
    { question: "How long does shipping take?", answer: "In-stock items ship within 2–3 business days. Made-to-order pieces show their crafting time on the product page.", category: "Shipping", sortOrder: 0 },
    { question: "How do I pay?", answer: "Place your order on the site (no payment needed). Vanshika confirms availability and shares easy payment options on WhatsApp.", category: "Orders", sortOrder: 1 },
    { question: "Are the products really handmade?", answer: "Yes — every piece is handcrafted in our Jaipur studio, so small variations are natural and part of the charm.", category: "Products", sortOrder: 2 },
    { question: "Can I personalise a gift?", answer: "Many pieces can be personalised — look for the personalisation option on the product page.", category: "Products", sortOrder: 3 },
    { question: "What is your return policy?", answer: "Ready-made items can be returned within 7 days if unused and in original condition. Personalised and made-to-order pieces are final sale. Damaged items are always replaced.", category: "Returns", sortOrder: 4 },
    { question: "Do you take bulk or corporate orders?", answer: "Absolutely — visit our Bulk Orders page to send an enquiry and we'll craft a quote.", category: "Orders", sortOrder: 5 },
  ];
  for (const f of faqs) {
    await prisma.faqItem.create({ data: { ...f, isPublished: true } });
  }

  await prisma.banner.create({
    data: { type: "marquee", text: "Handmade in Jaipur ✦ Free shipping over ₹1,500 ✦ Pay easily on WhatsApp", isActive: true, sortOrder: 0 },
  });
}

async function main() {
  console.log("🌱 Seeding settings + admin + email templates…");
  await seedSettingsAndAdmin();

  if (process.env.NODE_ENV === "production") {
    console.log("⏭️  Production detected — skipping catalog/content reseed.");
    return;
  }

  console.log("🧹 Clearing catalog + CMS content…");
  await clearContent();
  console.log("🛍️  Seeding catalog…");
  const counts = await seedCatalog();
  console.log("📝 Seeding homepage, testimonials, FAQ…");
  await seedCms();
  console.log(`✅ Seed complete: ${counts.categoryCount} categories, ${counts.collectionCount} collections, ${counts.productCount} products.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
