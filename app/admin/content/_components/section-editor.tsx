"use client";

import { HomepageSectionType } from "@prisma/client";
import { FormField, AdminInput } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { SECTION_TYPE_META } from "@/lib/admin/content-shared";
import { ActionForm, useFieldError } from "./action-form";
import { RichTextField } from "./rich-text-field";
import { SwitchField } from "./switch-field";
import { upsertHomepageSection } from "../_actions/homepage";
import { useEditorSheetClose } from "./editor-sheet";

/**
 * `SectionEditorForm` — the type-specific homepage-section editor (doc 15 §4.2,
 * FR-7). Renders only the fields relevant to `type`; posts flat FormData that the
 * Server Action re-assembles into the typed payload and re-validates against the
 * discriminated union (the server is the source of truth). Closes its sheet on a
 * successful save.
 */

export interface SectionEditorData {
  id?: string;
  isActive: boolean;
  expectedUpdatedAt?: string;
  payload?: Record<string, unknown>;
}

/** A single text input field bound to the ActionForm error context. */
function TextField({
  name,
  label,
  defaultValue,
  required,
  placeholder,
  hint,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: unknown;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  const error = useFieldError(name);
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <AdminInput
        name={name}
        type={type}
        defaultValue={typeof defaultValue === "string" || typeof defaultValue === "number" ? String(defaultValue) : ""}
        required={required}
        placeholder={placeholder}
      />
    </FormField>
  );
}

/** Comma/newline list field → server splits into an id array. */
function ListField({
  name,
  label,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: unknown;
  hint?: string;
}) {
  const error = useFieldError(name);
  const value = Array.isArray(defaultValue) ? (defaultValue as string[]).join(", ") : "";
  return (
    <FormField label={label} error={error} hint={hint}>
      <AdminInput name={name} defaultValue={value} placeholder="id-1, id-2, id-3" />
    </FormField>
  );
}

/** Heading + sub-copy pair carried by most section types. */
function HeadingFields({ p }: { p: Record<string, unknown> }) {
  return (
    <>
      <TextField name="title" label="Heading" defaultValue={p.title} placeholder="Section heading" />
      <TextField name="sub" label="Sub-copy" defaultValue={p.sub} placeholder="Optional supporting line" />
    </>
  );
}

function TypeFields({ type, p }: { type: HomepageSectionType; p: Record<string, unknown> }) {
  switch (type) {
    case HomepageSectionType.hero:
      return (
        <>
          <TextField name="headline" label="Headline" defaultValue={p.headline} required placeholder="Handmade with heart, in Jaipur" />
          <TextField name="sub" label="Sub-copy" defaultValue={p.sub} placeholder="One-of-a-kind gifts & home décor…" />
          <TextField name="ctaLabel" label="CTA label" defaultValue={p.ctaLabel} placeholder="Shop the collection" />
          <TextField name="ctaHref" label="CTA link" defaultValue={p.ctaHref} placeholder="/products" hint="A path (/products) or full https URL." />
          <TextField name="mediaId" label="Background image ID" defaultValue={p.mediaId} hint="A MediaAsset id from your library." />
        </>
      );
    case HomepageSectionType.featured_products:
      return (
        <>
          <HeadingFields p={p} />
          <TextField name="collectionId" label="Source collection ID" defaultValue={p.collectionId} hint="Optional — pulls products from a collection." />
          <ListField name="productIds" label="Product IDs" defaultValue={p.productIds} hint="Comma-separated product ids (overrides the collection)." />
          <TextField name="limit" label="Max items" defaultValue={p.limit ?? 8} type="number" />
        </>
      );
    case HomepageSectionType.featured_collections:
      return (
        <>
          <HeadingFields p={p} />
          <ListField name="collectionIds" label="Collection IDs" defaultValue={p.collectionIds} hint="Comma-separated collection ids." />
          <TextField name="limit" label="Max items" defaultValue={p.limit ?? 6} type="number" />
        </>
      );
    case HomepageSectionType.category_grid:
      return (
        <>
          <HeadingFields p={p} />
          <TextField name="limit" label="Max categories" defaultValue={p.limit ?? 6} type="number" />
        </>
      );
    case HomepageSectionType.bestsellers:
      return (
        <>
          <HeadingFields p={p} />
          <TextField name="collectionSlug" label="Source collection slug" defaultValue={p.collectionSlug} placeholder="bestsellers" />
          <TextField name="limit" label="Max items" defaultValue={p.limit ?? 8} type="number" />
        </>
      );
    case HomepageSectionType.testimonials:
      return (
        <>
          <HeadingFields p={p} />
          <SwitchField name="featuredOnly" label="Featured only" description="Show only featured testimonials." defaultChecked={p.featuredOnly !== false} />
          <TextField name="limit" label="Max quotes" defaultValue={p.limit ?? 6} type="number" />
        </>
      );
    case HomepageSectionType.banner:
      return (
        <>
          <HeadingFields p={p} />
          <TextField name="bannerId" label="Banner ID" defaultValue={p.bannerId} hint="Link to a Banner row." />
          <TextField name="mediaId" label="Image ID" defaultValue={p.mediaId} />
          <TextField name="href" label="Link" defaultValue={p.href} placeholder="/collections/diwali-gifts" />
        </>
      );
    case HomepageSectionType.story:
      return (
        <>
          <TextField name="title" label="Heading" defaultValue={p.title} placeholder="Meet the maker" />
          <RichTextField name="body" label="Story" defaultValue={typeof p.body === "string" ? p.body : ""} required maxLength={8000} />
          <TextField name="mediaId" label="Image ID" defaultValue={p.mediaId} />
          <TextField name="ctaLabel" label="CTA label" defaultValue={p.ctaLabel} />
          <TextField name="ctaHref" label="CTA link" defaultValue={p.ctaHref} placeholder="/about" />
        </>
      );
    case HomepageSectionType.instagram:
      return (
        <>
          <HeadingFields p={p} />
          <TextField name="handle" label="Instagram handle" defaultValue={p.handle} placeholder="googlywoogly.art" />
        </>
      );
    case HomepageSectionType.newsletter:
      return (
        <>
          <TextField name="title" label="Heading" defaultValue={p.title} placeholder="First dibs on new drops" />
          <TextField name="sub" label="Sub-copy" defaultValue={p.sub} />
          <TextField name="consentText" label="Consent line" defaultValue={p.consentText} placeholder="By subscribing you agree to…" />
        </>
      );
    case HomepageSectionType.faq:
      return (
        <>
          <HeadingFields p={p} />
          <ListField name="faqIds" label="FAQ IDs" defaultValue={p.faqIds} hint="Comma-separated FAQ ids, or leave blank for the top N." />
          <TextField name="limit" label="Max items" defaultValue={p.limit ?? 6} type="number" />
        </>
      );
    case HomepageSectionType.rich_text:
      return (
        <>
          <TextField name="title" label="Heading" defaultValue={p.title} />
          <RichTextField name="body" label="Content" defaultValue={typeof p.body === "string" ? p.body : ""} required maxLength={8000} />
        </>
      );
    default:
      return null;
  }
}

export function SectionEditorForm({
  type,
  data,
}: {
  type: HomepageSectionType;
  data?: SectionEditorData;
}) {
  const close = useEditorSheetClose();
  const p = data?.payload ?? {};
  return (
    <ActionForm action={upsertHomepageSection} onSuccess={close}>
      <input type="hidden" name="type" value={type} />
      {data?.id ? <input type="hidden" name="id" value={data.id} /> : null}
      {data?.expectedUpdatedAt ? (
        <input type="hidden" name="expectedUpdatedAt" value={data.expectedUpdatedAt} />
      ) : null}

      <p className="text-xs text-muted-foreground">{SECTION_TYPE_META[type].description}</p>

      <TypeFields type={type} p={p} />

      <SwitchField
        name="isActive"
        label="Show on homepage"
        defaultChecked={data?.isActive ?? true}
      />

      <div className="flex justify-end gap-2 pt-2">
        <SubmitButton pendingText="Saving…">Save section</SubmitButton>
      </div>
    </ActionForm>
  );
}
