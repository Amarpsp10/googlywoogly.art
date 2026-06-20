"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { CollectionType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  FormField,
  AdminInput,
  AdminTextarea,
  AdminSelect,
} from "@/components/admin/form-field";
import { Panel } from "@/components/admin/panel";
import { SubmitButton } from "@/components/admin/submit-button";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { upsertCollection } from "./actions";
import { collectionInputSchema, type CollectionRules } from "./schema";
import { RulesBuilder } from "./rules-builder";

/**
 * Collection create/edit "Details" form (docs/11 §4.6). A Server-Action `<form>`
 * with client pre-validation (`collectionInputSchema`) and authoritative server
 * re-validation in `upsertCollection`. Switching `type` to **automated** reveals
 * the V1 rules builder (membership materializes later — FR-40/41); **manual**
 * collections manage members on the Members tab/section.
 */

export interface CollectionFormValues {
  id?: string;
  title: string;
  slug: string;
  description: string;
  heroImageId: string;
  type: CollectionType;
  rules: CollectionRules;
  sortOrder: number;
  isActive: boolean;
  isFeaturedOnHome: boolean;
  metaTitle: string;
  metaDescription: string;
}

export function CollectionForm({ initial }: { initial: CollectionFormValues }) {
  const router = useRouter();
  const isEdit = Boolean(initial.id);

  const [title, setTitle] = React.useState(initial.title);
  const [slug, setSlug] = React.useState(initial.slug);
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initial.slug));
  const [type, setType] = React.useState<CollectionType>(initial.type);
  const [rules, setRules] = React.useState<CollectionRules>(initial.rules);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  const fieldError = (k: string) => errors[k]?.[0];
  const isAutomated = type === CollectionType.automated;

  async function action(formData: FormData) {
    const payload = {
      id: initial.id,
      title: String(formData.get("title") ?? ""),
      slug: String(formData.get("slug") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? ""),
      heroImageId: String(formData.get("heroImageId") ?? "").trim() || undefined,
      type,
      rules: isAutomated ? rules : undefined,
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      isActive: formData.get("isActive") === "on",
      isFeaturedOnHome: formData.get("isFeaturedOnHome") === "on",
      metaTitle: String(formData.get("metaTitle") ?? ""),
      metaDescription: String(formData.get("metaDescription") ?? ""),
    };

    const pre = collectionInputSchema.safeParse(payload);
    if (!pre.success) {
      setErrors(pre.error.flatten().fieldErrors as Record<string, string[]>);
      toast.error("Please correct the highlighted fields.");
      return;
    }

    const result = await upsertCollection(payload);
    if (result.ok) {
      setErrors({});
      toast.success(isEdit ? "Collection saved." : "Collection created.");
      if (!isEdit) {
        // New collections open the editor so the founder can add members next.
        router.push(`/admin/collections/${result.data.id}/edit`);
      } else {
        router.refresh();
      }
      return;
    }
    setErrors(result.fieldErrors ?? {});
    toast.error(result.error);
  }

  return (
    <form action={action} className="space-y-6">
      <Panel title="Details">
        <div className="space-y-4">
          <FormField label="Title" required error={fieldError("title")}>
            <AdminInput
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Diwali Gifts"
              autoFocus={!isEdit}
              required
            />
          </FormField>

          <FormField
            label="Web address (slug)"
            hint="Used in the page URL: /collections/your-slug. Leave blank to auto-generate."
            error={fieldError("slug")}
          >
            <AdminInput
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              inputMode="url"
              placeholder="diwali-gifts"
              spellCheck={false}
            />
          </FormField>

          <FormField
            label="Description"
            hint="Landing copy shown at the top of the collection page."
            error={fieldError("description")}
          >
            <AdminTextarea
              name="description"
              defaultValue={initial.description}
              rows={4}
              maxLength={2000}
              placeholder="Curated gifts to light up the festival of lights…"
            />
          </FormField>
        </div>
      </Panel>

      <Panel
        title="Type & membership"
        description="Manual collections are curated by hand. Automated collections fill from rules (coming soon)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Type" error={fieldError("type")}>
            <AdminSelect
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as CollectionType)}
            >
              <option value={CollectionType.manual}>Manual — pick products</option>
              <option value={CollectionType.automated}>Automated — by rules</option>
            </AdminSelect>
          </FormField>

          <FormField
            label="Sort order"
            hint="Lower numbers show first."
            error={fieldError("sortOrder")}
          >
            <AdminInput
              name="sortOrder"
              type="number"
              min={0}
              step={1}
              defaultValue={initial.sortOrder}
              inputMode="numeric"
            />
          </FormField>
        </div>

        {isAutomated ? (
          <div className="mt-4">
            <RulesBuilder value={rules} onChange={setRules} error={fieldError("rules")} />
          </div>
        ) : isEdit ? (
          <p className="mt-4 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Add and reorder products in the <strong>Members</strong> section below.
          </p>
        ) : (
          <p className="mt-4 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Save the collection first, then add products to it.
          </p>
        )}
      </Panel>

      <Panel title="Visibility">
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={initial.isActive}
              className="size-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-sm font-medium text-foreground">
              Active{" "}
              <span className="font-normal text-muted-foreground">
                — visible on the store
              </span>
            </span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isFeaturedOnHome"
              defaultChecked={initial.isFeaturedOnHome}
              className="size-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-sm font-medium text-foreground">
              Feature on homepage{" "}
              <span className="font-normal text-muted-foreground">
                — show this collection on the landing page
              </span>
            </span>
          </label>
        </div>
      </Panel>

      <Panel
        title="SEO"
        description="How this collection looks on Google and when shared."
      >
        <div className="space-y-4">
          <FormField
            label="Meta title"
            hint="≤ 70 characters. Falls back to the title when empty."
            error={fieldError("metaTitle")}
          >
            <AdminInput
              name="metaTitle"
              defaultValue={initial.metaTitle}
              maxLength={70}
              placeholder={title || "Collection title for search"}
            />
          </FormField>
          <FormField
            label="Meta description"
            hint="≤ 200 characters."
            error={fieldError("metaDescription")}
          >
            <AdminTextarea
              name="metaDescription"
              defaultValue={initial.metaDescription}
              rows={3}
              maxLength={200}
              placeholder="A concise summary for search results…"
            />
          </FormField>
        </div>
      </Panel>

      {/* Hidden hero image id — wired to <MediaPicker> by the media agent later. */}
      <input type="hidden" name="heroImageId" defaultValue={initial.heroImageId} />

      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-border",
          "bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:rounded-2xl sm:border sm:px-5",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/collections")}
          className="min-h-11"
        >
          Cancel
        </Button>
        <SubmitButton pendingText={isEdit ? "Saving…" : "Creating…"}>
          <Save className="size-4" aria-hidden />
          {isEdit ? "Save details" : "Create collection"}
        </SubmitButton>
      </div>
    </form>
  );
}
