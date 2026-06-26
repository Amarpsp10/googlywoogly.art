"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import {
  Check,
  X,
  ExternalLink,
  Save,
  Rocket,
  EyeOff,
  Copy,
  Archive,
  Loader2,
} from "lucide-react";
import { adminProductInputSchema } from "@/lib/validations/catalog";
import { paiseToRupees, rupeesToPaise, formatPaise, discountPercent } from "@/lib/money";
import { deriveInventoryState } from "@/lib/inventory";
import { INVENTORY_STATE, OCCASIONS } from "@/lib/constants";
import { slugify } from "@/lib/slug";
import { publicEnv } from "@/lib/env";
import type { ActionResult } from "@/lib/result";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  FormField,
  AdminInput,
  AdminTextarea,
  AdminLabel,
} from "@/components/admin/form-field";
import { TagInput } from "@/components/admin/tag-input";
import { MultiSelect, type MultiSelectOption } from "@/components/admin/multi-select";
import {
  ProductMediaManager,
  type ProductImageDraft,
} from "@/components/admin/product-media-manager";
import {
  createProduct,
  updateProduct,
  duplicateProduct,
  setProductStatus,
  type ProductImageInput,
} from "@/app/admin/products/actions";
import type {
  AdminProductDetail,
  CategoryOption,
  CollectionOption,
} from "@/lib/services/admin-products";
import { cn } from "@/lib/utils";

/**
 * `ProductForm` — the catalog editor centerpiece (docs/11 §4). One client
 * component serves both `/admin/products/new` (empty draft) and
 * `/admin/products/[id]/edit` (hydrated). It is a focused client island: the RSC
 * page loads taxonomy + product server-side and passes it in.
 *
 * Validation: `react-hook-form` + `zodResolver(adminProductInputSchema)` for
 * inline UX; the Server Action re-validates authoritatively (the source of
 * truth). Money fields are entered in ₹ and converted to integer paise at the
 * action boundary (docs/11 FR-3). The publish gate (price>0, ≥1 image, category,
 * MTO lead time) is shown as a live checklist and enforced server-side (FR-4).
 *
 * `canEditCost` is false for `staff` (they never reach this form, but the prop
 * keeps `costPrice`/margin out of the tree defensively — docs/11 FR-19/§1.3).
 */

/** RHF form shape: money in ₹ (UI), arrays for pickers; mirrors the Zod fields. */
interface ProductFormValues {
  title: string;
  subtitle: string;
  slug: string;
  description: string;
  shortDescription: string;
  sku: string;
  priceRupees: string;
  compareAtRupees: string;
  costRupees: string;
  inventoryQuantity: string;
  madeToOrder: boolean;
  productionLeadTimeDays: string;
  lowStockThreshold: string;
  allowsPersonalization: boolean;
  personalizationLabel: string;
  materials: string;
  careInstructions: string;
  dimLength: string;
  dimWidth: string;
  dimHeight: string;
  dimDiameter: string;
  dimUnit: "cm" | "in";
  weightGrams: string;
  categoryId: string;
  collectionIds: string[];
  tags: string[];
  occasions: string[];
  isFeatured: boolean;
  isBestseller: boolean;
  metaTitle: string;
  metaDescription: string;
}

type ProductStatus = "draft" | "active" | "archived";

const STORE_SUFFIX = "GooglyWoogly Art";

function num(value: string): number | undefined {
  const t = value.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Defaults for a brand-new product. */
function emptyDefaults(): ProductFormValues {
  return {
    title: "",
    subtitle: "",
    slug: "",
    description: "",
    shortDescription: "",
    sku: "",
    priceRupees: "",
    compareAtRupees: "",
    costRupees: "",
    inventoryQuantity: "0",
    madeToOrder: false,
    productionLeadTimeDays: "",
    lowStockThreshold: "3",
    allowsPersonalization: false,
    personalizationLabel: "",
    materials: "",
    careInstructions: "",
    dimLength: "",
    dimWidth: "",
    dimHeight: "",
    dimDiameter: "",
    dimUnit: "cm",
    weightGrams: "",
    categoryId: "",
    collectionIds: [],
    tags: [],
    occasions: [],
    isFeatured: false,
    isBestseller: false,
    metaTitle: "",
    metaDescription: "",
  };
}

/** Hydrate the RHF values from a persisted product (paise → ₹ strings). */
function hydrate(p: AdminProductDetail): ProductFormValues {
  const dims = (p.dimensions ?? null) as
    | { length?: number; width?: number; height?: number; diameter?: number; unit?: "cm" | "in" }
    | null;
  return {
    title: p.title,
    subtitle: p.subtitle ?? "",
    slug: p.slug,
    description: p.description ?? "",
    shortDescription: p.shortDescription ?? "",
    sku: p.sku,
    priceRupees: p.price ? String(paiseToRupees(p.price)) : "",
    compareAtRupees: p.compareAtPrice ? String(paiseToRupees(p.compareAtPrice)) : "",
    costRupees: p.costPrice ? String(paiseToRupees(p.costPrice)) : "",
    inventoryQuantity: String(p.inventoryQuantity),
    madeToOrder: p.madeToOrder,
    productionLeadTimeDays: p.productionLeadTimeDays ? String(p.productionLeadTimeDays) : "",
    lowStockThreshold: String(p.lowStockThreshold),
    allowsPersonalization: p.allowsPersonalization,
    personalizationLabel: p.personalizationLabel ?? "",
    materials: p.materials ?? "",
    careInstructions: p.careInstructions ?? "",
    dimLength: dims?.length ? String(dims.length) : "",
    dimWidth: dims?.width ? String(dims.width) : "",
    dimHeight: dims?.height ? String(dims.height) : "",
    dimDiameter: dims?.diameter ? String(dims.diameter) : "",
    dimUnit: dims?.unit ?? "cm",
    weightGrams: p.weightGrams ? String(p.weightGrams) : "",
    categoryId: p.categoryId ?? "",
    collectionIds: p.collections.map((c) => c.collectionId),
    tags: p.tags,
    occasions: p.occasions,
    isFeatured: p.isFeatured,
    isBestseller: p.isBestseller,
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
  };
}

/**
 * Map RHF UI values → the `adminProductInputSchema` input shape (₹ → paise,
 * dimensions assembled, blanks → undefined). Status defaults to `draft` for
 * pure validation; `toInput` overrides it for the actual save.
 */
function mapValuesToSchemaInput(
  v: ProductFormValues,
  status: ProductStatus = "draft",
): Record<string, unknown> {
  const dimensions =
    num(v.dimLength) || num(v.dimWidth) || num(v.dimHeight) || num(v.dimDiameter)
      ? {
          length: num(v.dimLength),
          width: num(v.dimWidth),
          height: num(v.dimHeight),
          diameter: num(v.dimDiameter),
          unit: v.dimUnit,
        }
      : undefined;

  const priceR = num(v.priceRupees) ?? 0;
  const compareR = num(v.compareAtRupees);
  const costR = num(v.costRupees);

  return {
    title: v.title,
    subtitle: v.subtitle || undefined,
    slug: v.slug || slugify(v.title),
    description: v.description,
    shortDescription: v.shortDescription || undefined,
    sku: v.sku,
    price: rupeesToPaise(priceR),
    compareAtPrice: compareR !== undefined ? rupeesToPaise(compareR) : undefined,
    costPrice: costR !== undefined ? rupeesToPaise(costR) : undefined,
    status,
    inventoryQuantity: num(v.inventoryQuantity) ?? 0,
    madeToOrder: v.madeToOrder,
    productionLeadTimeDays: num(v.productionLeadTimeDays),
    lowStockThreshold: num(v.lowStockThreshold) ?? 3,
    allowsPersonalization: v.allowsPersonalization,
    personalizationLabel: v.personalizationLabel || undefined,
    materials: v.materials || undefined,
    careInstructions: v.careInstructions || undefined,
    dimensions,
    weightGrams: num(v.weightGrams),
    categoryId: v.categoryId || undefined,
    collectionIds: v.collectionIds,
    tags: v.tags,
    occasions: v.occasions,
    isFeatured: v.isFeatured,
    isBestseller: v.isBestseller,
    metaTitle: v.metaTitle || undefined,
    metaDescription: v.metaDescription || undefined,
  };
}

/** Build the validated AdminProductInput payload from RHF values (₹ → paise). */
function toInput(v: ProductFormValues, status: ProductStatus): unknown {
  return mapValuesToSchemaInput(v, status);
}

/** Schema field name → RHF/UI field name (money fields are aliased to ₹). */
const SCHEMA_TO_FORM_FIELD: Record<string, keyof ProductFormValues> = {
  title: "title",
  subtitle: "subtitle",
  slug: "slug",
  description: "description",
  shortDescription: "shortDescription",
  sku: "sku",
  price: "priceRupees",
  compareAtPrice: "compareAtRupees",
  costPrice: "costRupees",
  inventoryQuantity: "inventoryQuantity",
  productionLeadTimeDays: "productionLeadTimeDays",
  lowStockThreshold: "lowStockThreshold",
  personalizationLabel: "personalizationLabel",
  materials: "materials",
  careInstructions: "careInstructions",
  weightGrams: "weightGrams",
  categoryId: "categoryId",
  metaTitle: "metaTitle",
  metaDescription: "metaDescription",
};

/**
 * Custom RHF resolver that validates the UI values against the SHARED
 * `adminProductInputSchema` (the single source of validation, docs/11 FR-3) by
 * first mapping ₹→paise / assembling dimensions, then translating any Zod field
 * errors back onto the UI field names (e.g. `price` → `priceRupees`). Submit
 * always receives the raw UI `values`; the Server Action re-validates the
 * authoritative payload. Draft-min rules apply inline (publish gate is server).
 */
const productFormResolver: Resolver<ProductFormValues> = (values) => {
  const mapped = mapValuesToSchemaInput(values, "draft");
  const result = adminProductInputSchema.safeParse(mapped);
  if (result.success) {
    return { values, errors: {} };
  }
  const errors: FieldErrors<ProductFormValues> = {};
  for (const issue of result.error.issues) {
    const schemaField = String(issue.path[0] ?? "");
    const formField = SCHEMA_TO_FORM_FIELD[schemaField];
    if (!formField || errors[formField]) continue; // first error per field
    errors[formField] = { type: "validation", message: issue.message } as never;
  }
  // RHF's error branch expects empty `values`.
  return { values: {}, errors };
};

/** Map the draft media set onto the action's ProductImageInput shape. */
function toImageInputs(images: ProductImageDraft[]): ProductImageInput[] {
  return images.map((img) => ({
    mediaAssetId: img.mediaAssetId,
    url: img.url,
    alt: img.alt || undefined,
    mediaType: img.mediaType ?? "image",
    width: img.width,
    height: img.height,
    duration: img.duration,
    publicId: img.publicId,
    sizeBytes: img.sizeBytes,
    isPrimary: img.isPrimary,
  }));
}

export function ProductForm({
  product,
  categories,
  collections,
  tagSuggestions,
  canEditCost,
  uploadEnabled = false,
}: {
  /** Null for the "new" route; the persisted product for "edit". */
  product: AdminProductDetail | null;
  categories: CategoryOption[];
  collections: CollectionOption[];
  tagSuggestions: string[];
  canEditCost: boolean;
  /** Whether Cloudinary is configured (enables the upload dropzone). */
  uploadEnabled?: boolean;
}) {
  const router = useRouter();
  const isEdit = product !== null;

  const [status, setStatus] = React.useState<ProductStatus>(
    (product?.status as ProductStatus) ?? "draft",
  );
  const [images, setImages] = React.useState<ProductImageDraft[]>(() => {
    if (!product) return [];
    const imgs = product.images;
    // Primary is image-only: ignore videos, and fall back to the first IMAGE row.
    const anyPrimary = imgs.some((x) => x.isPrimary && x.type !== "video");
    const firstImageIdx = imgs.findIndex((x) => x.type !== "video");
    return imgs.map((img, i) => ({
      key: `existing-${img.id}`,
      mediaAssetId: img.mediaAssetId ?? undefined,
      url: img.url,
      alt: img.alt ?? "",
      mediaType: img.type === "video" ? "video" : "image",
      width: img.width ?? undefined,
      height: img.height ?? undefined,
      isPrimary: img.type !== "video" && (anyPrimary ? img.isPrimary : i === firstImageIdx),
    }));
  });
  const [slugEditable, setSlugEditable] = React.useState(!isEdit || product?.publishedAt === null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    resolver: productFormResolver,
    defaultValues: product ? hydrate(product) : emptyDefaults(),
    mode: "onTouched",
  });

  // ── Live derived values ────────────────────────────────────────────────
  const title = watch("title");
  const slug = watch("slug");
  const madeToOrder = watch("madeToOrder");
  const inventoryQuantity = watch("inventoryQuantity");
  const lowStockThreshold = watch("lowStockThreshold");
  const leadTime = watch("productionLeadTimeDays");
  const priceRupees = watch("priceRupees");
  const compareAtRupees = watch("compareAtRupees");
  const costRupees = watch("costRupees");
  const allowsPersonalization = watch("allowsPersonalization");
  const metaTitle = watch("metaTitle");
  const metaDescription = watch("metaDescription");
  const shortDescription = watch("shortDescription");
  const dimLength = watch("dimLength");
  const dimWidth = watch("dimWidth");
  const dimHeight = watch("dimHeight");
  const dimDiameter = watch("dimDiameter");
  const dimUnit = watch("dimUnit");
  const sku = watch("sku");
  const categoryId = watch("categoryId");

  // Auto-generate the slug from the title until the product is published or the
  // founder edits it manually (FR-10).
  const slugTouchedRef = React.useRef(isEdit);
  React.useEffect(() => {
    if (slugTouchedRef.current) return;
    if (!slugEditable) return;
    setValue("slug", slugify(title || ""), { shouldValidate: false });
  }, [title, slugEditable, setValue]);

  const invState = deriveInventoryState({
    madeToOrder,
    inventoryQuantity: num(inventoryQuantity) ?? 0,
    lowStockThreshold: num(lowStockThreshold) ?? 0,
  });
  const invMeta = INVENTORY_STATE[invState];

  const priceP = rupeesToPaise(num(priceRupees) ?? 0);
  const compareP = compareAtRupees.trim() ? rupeesToPaise(num(compareAtRupees) ?? 0) : null;
  const costP = costRupees.trim() ? rupeesToPaise(num(costRupees) ?? 0) : null;
  const savePct = compareP ? discountPercent(priceP, compareP) : 0;
  const marginP = costP !== null ? priceP - costP : null;
  const marginPct = costP !== null && priceP > 0 ? Math.round(((priceP - costP) / priceP) * 100) : null;

  // ── Publish checklist (FR-4) ──────────────────────────────────────────
  const checklist = [
    { label: "Title", ok: title.trim().length > 0 },
    { label: "SKU", ok: sku.trim().length > 0 },
    { label: "Price > ₹0", ok: priceP > 0 },
    { label: "At least one image", ok: images.length > 0 },
    { label: "Category", ok: categoryId.trim().length > 0 },
    ...(madeToOrder
      ? [{ label: "Lead time (days)", ok: (num(leadTime) ?? 0) >= 1 }]
      : []),
  ];
  const canPublish = checklist.every((c) => c.ok);

  // ── Submit handlers ────────────────────────────────────────────────────
  const applyServerErrors = (res: Extract<ActionResult<unknown>, { ok: false }>) => {
    setServerError(res.error);
    if (res.fieldErrors) {
      for (const [name, messages] of Object.entries(res.fieldErrors)) {
        if (!messages?.length) continue;
        // `images` is a non-RHF field — surface it only as the banner error.
        const fieldName = SCHEMA_TO_FORM_FIELD[name];
        if (fieldName) {
          setError(fieldName, { type: "server", message: messages[0] });
        }
      }
    }
    toast.error(res.error);
  };

  const submit = (targetStatus: ProductStatus) =>
    handleSubmit((values) => {
      setServerError(null);
      const productInput = toInput(values, targetStatus);
      const imageInputs = toImageInputs(images);

      startTransition(async () => {
        if (product) {
          const res = await updateProduct({
            product: productInput,
            images: imageInputs,
            id: product.id,
            expectedUpdatedAt: product.updatedAt.toISOString(),
          });
          if (!res.ok) {
            applyServerErrors(res);
            return;
          }
          setStatus(targetStatus);
          toast.success(targetStatus === "active" ? "Published!" : "Saved.");
          router.refresh();
          return;
        }

        const res = await createProduct({ product: productInput, images: imageInputs });
        if (!res.ok) {
          applyServerErrors(res);
          return;
        }
        setStatus(targetStatus);
        toast.success(targetStatus === "active" ? "Published!" : "Saved as draft.");
        router.push(`/admin/products/${res.data.id}/edit`);
      });
    });

  const onSaveDraft = submit("draft");
  const onPublish = submit("active");

  // Status-only actions (edit mode, on an existing row).
  const runStatusAction = (next: ProductStatus, successMsg: string) => {
    if (!isEdit) return;
    setServerError(null);
    startTransition(async () => {
      const res = await setProductStatus({ id: product.id, status: next });
      if (!res.ok) {
        setServerError(res.error);
        toast.error(res.error);
        return;
      }
      setStatus(next);
      toast.success(successMsg);
      router.refresh();
    });
  };

  const onDuplicate = () => {
    if (!isEdit) return;
    startTransition(async () => {
      const res = await duplicateProduct({ id: product.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Duplicated — editing the copy.");
      router.push(`/admin/products/${res.data.id}/edit`);
    });
  };

  // ── Option lists ───────────────────────────────────────────────────────
  const categoryName = (c: CategoryOption) =>
    c.parentId ? `— ${c.name}` : c.name;
  const collectionOptions: MultiSelectOption[] = collections.map((c) => ({
    value: c.id,
    label: c.title,
    disabled: c.type === "automated",
    hint: c.type === "automated" ? "auto by rules" : c.isActive ? undefined : "hidden",
  }));
  const occasionSuggestions = [...OCCASIONS];

  const storefrontUrl = `${publicEnv.siteUrl}/products/${slug || "…"}`;
  const effectiveMetaTitle = (metaTitle || `${title || "Product"} · ${STORE_SUFFIX}`).trim();
  const effectiveMetaDesc = (
    metaDescription ||
    shortDescription ||
    "A handmade piece from GooglyWoogly Art."
  ).trim();

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_22rem]"
      noValidate
    >
      {/* ── MAIN COLUMN ─────────────────────────────────────────────── */}
      <div className="order-2 space-y-5 lg:order-1">
        {/* BASICS */}
        <Panel title="Basics">
          <div className="space-y-4">
            <FormField label="Title" required error={errors.title?.message}>
              <AdminInput
                {...register("title")}
                placeholder="Hand-painted Ceramic Diya Set"
                maxLength={120}
                autoFocus={!isEdit}
              />
            </FormField>

            <FormField label="Subtitle" hint="A short one-line tagline (optional)." error={errors.subtitle?.message}>
              <AdminInput {...register("subtitle")} placeholder="Set of 4 · brass accents" maxLength={120} />
            </FormField>

            <FormField
              label="Web address (slug)"
              error={errors.slug?.message}
              hint={storefrontUrl}
            >
              <div className="flex gap-2">
                <AdminInput
                  {...register("slug")}
                  disabled={!slugEditable}
                  onChange={(e) => {
                    slugTouchedRef.current = true;
                    setValue("slug", e.target.value);
                  }}
                  placeholder="hand-painted-ceramic-diya-set"
                />
                {isEdit && product?.publishedAt !== null && !slugEditable ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setSlugEditable(true);
                      slugTouchedRef.current = true;
                    }}
                  >
                    Edit URL
                  </Button>
                ) : null}
              </div>
              {isEdit && product?.publishedAt !== null && slugEditable ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Changing the address creates a 301 redirect from the old link.
                </p>
              ) : null}
            </FormField>

            <FormField label="Short description" hint="≤ 200 chars · used on cards and in search results." error={errors.shortDescription?.message}>
              <AdminTextarea {...register("shortDescription")} rows={2} maxLength={200} />
            </FormField>

            <FormField label="Description" hint="The full product story shown on the page." error={errors.description?.message}>
              <AdminTextarea {...register("description")} rows={6} />
            </FormField>

            <FormField label="SKU" required hint="A unique stock code (e.g. GW-DIYA-014)." error={errors.sku?.message}>
              <AdminInput {...register("sku")} placeholder="GW-DIYA-014" maxLength={64} />
            </FormField>
          </div>
        </Panel>

        {/* MEDIA */}
        <Panel
          title="Images"
          description={
            uploadEnabled
              ? "The first image is the hero shot (LCP). Drag & drop to upload, or paste a URL."
              : "The first image is the hero shot (LCP). Add by URL — no setup needed."
          }
        >
          <ProductMediaManager
            value={images}
            onChange={setImages}
            uploadEnabled={uploadEnabled}
          />
        </Panel>

        {/* PRICING */}
        <Panel title="Pricing">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Price (₹)" required error={errors.priceRupees?.message}>
              <RupeeInput {...register("priceRupees")} placeholder="1499" />
            </FormField>
            <FormField
              label="Compare-at price (₹)"
              hint="The strikethrough 'was' price (optional)."
              error={errors.compareAtRupees?.message}
            >
              <RupeeInput {...register("compareAtRupees")} placeholder="1875" />
            </FormField>
          </div>
          {compareP && savePct > 0 ? (
            <p className="mt-2 text-sm font-medium text-secondary-foreground">
              Save {formatPaise(compareP - priceP)} ({savePct}% off)
            </p>
          ) : null}

          {canEditCost ? (
            <div className="mt-4 rounded-xl bg-muted/40 p-3">
              <FormField
                label="Cost price (₹) — admin only"
                hint="Never shown to customers. Used to compute your margin."
                error={errors.costRupees?.message}
              >
                <RupeeInput {...register("costRupees")} placeholder="640" />
              </FormField>
              {marginP !== null ? (
                <p
                  className={cn(
                    "mt-2 text-sm font-medium",
                    marginP <= 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  Margin {formatPaise(marginP)} {marginPct !== null ? `(${marginPct}%)` : ""}
                  {marginP <= 0 ? " — selling at or below cost" : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </Panel>

        {/* INVENTORY */}
        <Panel
          title="Inventory"
          action={<StatusBadge tone={invMeta.tone} label={inventoryStateLabel(invState, num(inventoryQuantity) ?? 0, num(leadTime) ?? 0)} />}
        >
          <div className="space-y-4">
            <ToggleRow
              label="Made to order"
              description="Always available — crafted after each order."
              control={control}
              name="madeToOrder"
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Quantity in stock" error={errors.inventoryQuantity?.message}>
                <AdminInput
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  {...register("inventoryQuantity")}
                  className={cn(madeToOrder && "opacity-60")}
                />
              </FormField>
              <FormField label="Low-stock at ≤" error={errors.lowStockThreshold?.message}>
                <AdminInput type="number" inputMode="numeric" min={0} step={1} {...register("lowStockThreshold")} />
              </FormField>
              {madeToOrder ? (
                <FormField label="Ships in (days)" required error={errors.productionLeadTimeDays?.message}>
                  <AdminInput type="number" inputMode="numeric" min={1} step={1} {...register("productionLeadTimeDays")} />
                </FormField>
              ) : null}
            </div>
          </div>
        </Panel>

        {/* PERSONALIZATION */}
        <Panel title="Personalization">
          <div className="space-y-4">
            <ToggleRow
              label="Allow personalization"
              description="Let shoppers add a name / message to engrave."
              control={control}
              name="allowsPersonalization"
            />
            {allowsPersonalization ? (
              <FormField label="Personalization label" error={errors.personalizationLabel?.message}>
                <AdminInput {...register("personalizationLabel")} placeholder="Name to engrave" maxLength={80} />
              </FormField>
            ) : null}
          </div>
        </Panel>

        {/* ATTRIBUTES */}
        <Panel title="Attributes">
          <div className="space-y-4">
            <FormField label="Materials" error={errors.materials?.message}>
              <AdminInput {...register("materials")} placeholder="Mango wood, brass" maxLength={200} />
            </FormField>
            <div>
              <AdminLabel>Dimensions</AdminLabel>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <DimInput {...register("dimLength")} placeholder="L" />
                <DimInput {...register("dimWidth")} placeholder="W" />
                <DimInput {...register("dimHeight")} placeholder="H" />
                <DimInput {...register("dimDiameter")} placeholder="Ø" />
                <Controller
                  control={control}
                  name="dimUnit"
                  render={({ field }) => (
                    <select
                      value={field.value}
                      onChange={field.onChange}
                      aria-label="Dimension unit"
                      className="h-10 rounded-xl border border-input bg-background px-2 text-sm"
                    >
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                    </select>
                  )}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {dimensionPreview({ dimLength, dimWidth, dimHeight, dimDiameter, dimUnit })}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Weight (grams)" error={errors.weightGrams?.message}>
                <AdminInput type="number" inputMode="numeric" min={0} step={1} {...register("weightGrams")} placeholder="320" />
              </FormField>
            </div>
            <FormField label="Care instructions" error={errors.careInstructions?.message}>
              <AdminTextarea {...register("careInstructions")} rows={3} placeholder="Wipe clean with a dry cloth…" />
            </FormField>
          </div>
        </Panel>

        {/* SEO */}
        <Panel title="Search & social (SEO)">
          <div className="space-y-4">
            <FormField
              label="Meta title"
              hint={`${(metaTitle || "").length}/70 · ideal 50–60. Leave blank to use the title.`}
              error={errors.metaTitle?.message}
            >
              <AdminInput {...register("metaTitle")} maxLength={70} placeholder={`${title || "Product"} · ${STORE_SUFFIX}`} />
            </FormField>
            <FormField
              label="Meta description"
              hint={`${(metaDescription || "").length}/200 · ideal 150–160. Falls back to the short description.`}
              error={errors.metaDescription?.message}
            >
              <AdminTextarea {...register("metaDescription")} rows={3} maxLength={200} />
            </FormField>

            {/* Live Google SERP preview (FR-38) */}
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                How this looks on Google
              </p>
              <p className="truncate text-xs text-secondary-foreground">
                googlywoogly.art › products › {slug || "…"}
              </p>
              <p className="truncate text-base text-[#1a0dab]">{effectiveMetaTitle}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{effectiveMetaDesc}</p>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── RIGHT RAIL ──────────────────────────────────────────────── */}
      <aside className="order-1 space-y-5 lg:order-2">
        {/* STATUS + ACTIONS (sticky on desktop) */}
        <div className="lg:sticky lg:top-4 lg:z-10 space-y-5">
          <Panel title="Status & visibility">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StatusBadge
                  tone={status === "active" ? "success" : status === "archived" ? "neutral" : "warning"}
                  label={status === "active" ? "Active" : status === "archived" ? "Archived" : "Draft"}
                />
                {isEdit && status === "active" ? (
                  <a
                    href={storefrontUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View on store <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>

              {/* Save / Publish */}
              <div className="grid grid-cols-1 gap-2">
                <Button type="button" variant="outline" onClick={onSaveDraft} disabled={isPending}>
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save draft
                </Button>
                <Button
                  type="button"
                  onClick={onPublish}
                  disabled={isPending || !canPublish}
                  title={canPublish ? undefined : "Complete the checklist below to publish"}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                  {status === "active" ? "Save & keep live" : "Publish"}
                </Button>
              </div>

              {/* Secondary status actions (edit only) */}
              {isEdit ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {status === "active" ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => runStatusAction("draft", "Unpublished — moved to draft.")} disabled={isPending}>
                      <EyeOff className="size-4" /> Unpublish
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" size="sm" onClick={onDuplicate} disabled={isPending}>
                    <Copy className="size-4" /> Duplicate
                  </Button>
                  {status !== "archived" ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => runStatusAction("archived", "Archived. Order history kept.")} disabled={isPending}>
                      <Archive className="size-4" /> Archive
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" onClick={() => runStatusAction("draft", "Unarchived — moved to draft.")} disabled={isPending}>
                      <Archive className="size-4" /> Unarchive
                    </Button>
                  )}
                </div>
              ) : null}

              {serverError ? (
                <p role="alert" className="text-xs font-medium text-destructive">{serverError}</p>
              ) : null}
              {isDirty ? (
                <p className="text-xs text-muted-foreground">You have unsaved changes.</p>
              ) : null}
            </div>
          </Panel>

          {/* PUBLISH CHECKLIST (FR-4) */}
          <Panel title="Publish checklist">
            <ul className="space-y-1.5">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-sm">
                  {c.ok ? (
                    <Check className="size-4 text-secondary-foreground" aria-hidden />
                  ) : (
                    <X className="size-4 text-destructive" aria-hidden />
                  )}
                  <span className={cn(c.ok ? "text-foreground" : "text-muted-foreground")}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* ORGANIZATION */}
        <Panel title="Organization">
          <div className="space-y-4">
            <FormField label="Category" required={status === "active"} error={errors.categoryId?.message}>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <select
                    value={field.value}
                    onChange={field.onChange}
                    className="h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} disabled={!c.isActive}>
                        {categoryName(c)}
                        {!c.isActive ? " (hidden)" : ""}
                      </option>
                    ))}
                  </select>
                )}
              />
            </FormField>

            <div>
              <AdminLabel>Collections</AdminLabel>
              <div className="mt-1.5">
                <Controller
                  control={control}
                  name="collectionIds"
                  render={({ field }) => (
                    <MultiSelect
                      options={collectionOptions}
                      value={field.value}
                      onChange={field.onChange}
                      ariaLabel="Collections"
                      emptyText="No collections yet."
                    />
                  )}
                />
              </div>
            </div>

            <div>
              <AdminLabel htmlFor="product-tags">Tags</AdminLabel>
              <div className="mt-1.5">
                <Controller
                  control={control}
                  name="tags"
                  render={({ field }) => (
                    <TagInput id="product-tags" value={field.value} onChange={field.onChange} suggestions={tagSuggestions} />
                  )}
                />
              </div>
            </div>

            <div>
              <AdminLabel htmlFor="product-occasions">Occasions</AdminLabel>
              <div className="mt-1.5">
                <Controller
                  control={control}
                  name="occasions"
                  render={({ field }) => (
                    <TagInput
                      id="product-occasions"
                      value={field.value}
                      onChange={field.onChange}
                      suggestions={occasionSuggestions}
                      lowercase={false}
                      placeholder="Add an occasion…"
                    />
                  )}
                />
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <ToggleRow label="Featured" description="Eligible for the homepage." control={control} name="isFeatured" compact />
              <ToggleRow label="Bestseller" description="Shows a 'Bestseller' badge." control={control} name="isBestseller" compact />
            </div>
          </div>
        </Panel>
      </aside>
    </form>
  );
}

// ───────────────────────────── small field helpers ─────────────────────────────

/** ₹-prefixed number input (decimal allowed; ₹ → paise happens at submit). */
const RupeeInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof AdminInput>>(
  function RupeeInput(props, ref) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>
          ₹
        </span>
        <AdminInput
          ref={ref}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          className="pl-7"
          {...props}
        />
      </div>
    );
  },
);

const DimInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof AdminInput>>(
  function DimInput(props, ref) {
    return <AdminInput ref={ref} type="number" inputMode="decimal" min={0} step="0.1" {...props} />;
  },
);

/** A switch row with a label + description, wired to RHF via Controller. */
function ToggleRow({
  label,
  description,
  control,
  name,
  compact,
}: {
  label: string;
  description?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  name: keyof ProductFormValues;
  compact?: boolean;
}) {
  const id = `toggle-${name}`;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <AdminLabel htmlFor={id} className={cn(compact && "text-sm")}>{label}</AdminLabel>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch id={id} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
        )}
      />
    </div>
  );
}

/** Badge label that includes qty / lead time, matching the PDP copy (FR-22). */
function inventoryStateLabel(
  state: ReturnType<typeof deriveInventoryState>,
  qty: number,
  lead: number,
): string {
  switch (state) {
    case "made_to_order":
      return lead > 0 ? `Made to order · ships in ${lead}d` : "Made to order";
    case "out_of_stock":
      return "Out of stock";
    case "low_stock":
      return `Low stock (${qty} left)`;
    case "in_stock":
      return `In stock (${qty})`;
  }
}

/** Preview the formatted dimension string the PDP renders (FR-36). */
function dimensionPreview(v: {
  dimLength: string;
  dimWidth: string;
  dimHeight: string;
  dimDiameter: string;
  dimUnit: "cm" | "in";
}): string {
  const unit = v.dimUnit;
  if (num(v.dimDiameter)) return `Ø ${v.dimDiameter} ${unit}`;
  const parts: string[] = [];
  if (num(v.dimLength)) parts.push(`L ${v.dimLength}`);
  if (num(v.dimWidth)) parts.push(`W ${v.dimWidth}`);
  if (num(v.dimHeight)) parts.push(`H ${v.dimHeight}`);
  return parts.length ? `${parts.join(" × ")} ${unit}` : "Add measurements to preview.";
}
