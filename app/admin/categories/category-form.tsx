"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FormField,
  AdminInput,
  AdminTextarea,
  AdminSelect,
} from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { Panel } from "@/components/admin/panel";
import { SingleImagePicker } from "@/components/admin/single-image-picker";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { upsertCategory } from "./actions";
import { categoryInputSchema } from "./schema";

/**
 * Category create/edit form (docs/11 §4.5). A single Server-Action `<form>`:
 * client-side it pre-validates with `categoryInputSchema` for instant feedback,
 * but the action re-validates server-side (authoritative). Field errors returned
 * by the action are mapped back onto the inputs and announced via toast.
 *
 * The slug auto-fills from the name until the founder edits it (then it sticks);
 * leaving it blank lets the server derive a unique slug.
 */

export interface CategoryFormValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  imageId: string;
  /** Current image URL for the picker preview ("" when none is set). */
  imageUrl: string;
  parentId: string;
  sortOrder: number;
  isActive: boolean;
  metaTitle: string;
  metaDescription: string;
}

export interface ParentOption {
  id: string;
  name: string;
}

export function CategoryForm({
  initial,
  parentOptions,
  /** When true, the parent select is disabled (this category has children). */
  parentLocked = false,
}: {
  initial: CategoryFormValues;
  parentOptions: ParentOption[];
  parentLocked?: boolean;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial.id);

  const [name, setName] = React.useState(initial.name);
  const [slug, setSlug] = React.useState(initial.slug);
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initial.slug));
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  // Keep slug mirrored to the name until the user takes over the slug field.
  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const fieldError = (k: keyof CategoryFormValues) => errors[k]?.[0];

  async function action(formData: FormData) {
    const payload = {
      id: initial.id,
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? ""),
      imageId: String(formData.get("imageId") ?? "").trim() || undefined,
      parentId: String(formData.get("parentId") ?? "").trim() || undefined,
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      isActive: formData.get("isActive") === "on",
      metaTitle: String(formData.get("metaTitle") ?? ""),
      metaDescription: String(formData.get("metaDescription") ?? ""),
    };

    // Client-side pre-validation (the server re-checks regardless).
    const pre = categoryInputSchema.safeParse(payload);
    if (!pre.success) {
      const fe = pre.error.flatten().fieldErrors as Record<string, string[]>;
      setErrors(fe);
      toast.error("Please correct the highlighted fields.");
      return;
    }

    const result = await upsertCategory(payload);
    if (result.ok) {
      setErrors({});
      toast.success(isEdit ? "Category saved." : "Category created.");
      router.push("/admin/categories");
      router.refresh();
      return;
    }
    setErrors(result.fieldErrors ?? {});
    toast.error(result.error);
  }

  return (
    <form action={action} className="space-y-6">
      <Panel title="Details">
        <div className="space-y-4">
          <FormField label="Name" required error={fieldError("name")}>
            <AdminInput
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Diyas & Candles"
              autoFocus={!isEdit}
              required
            />
          </FormField>

          <FormField
            label="Web address (slug)"
            hint="Used in the page URL: /category/your-slug. Leave blank to auto-generate."
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
              placeholder="diyas-candles"
              spellCheck={false}
            />
          </FormField>

          <FormField
            label="Description"
            hint="Shown on the category page header and used for SEO."
            error={fieldError("description")}
          >
            <AdminTextarea
              name="description"
              defaultValue={initial.description}
              rows={4}
              maxLength={2000}
              placeholder="A short, warm intro to this category…"
            />
          </FormField>
        </div>
      </Panel>

      <Panel title="Placement & visibility">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Parent category"
            hint={
              parentLocked
                ? "This category has sub-categories, so it can't become a child."
                : "Optional. Nesting is one level deep."
            }
            error={fieldError("parentId")}
          >
            <AdminSelect
              name="parentId"
              defaultValue={initial.parentId}
              disabled={parentLocked}
            >
              <option value="">None (top level)</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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

        <label className="mt-4 flex items-center gap-3">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initial.isActive}
            className="size-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="text-sm font-medium text-foreground">
            Active{" "}
            <span className="font-normal text-muted-foreground">
              — visible on the store and in navigation
            </span>
          </span>
        </label>
      </Panel>

      <Panel
        title="SEO"
        description="How this category looks on Google and when shared."
      >
        <div className="space-y-4">
          <FormField
            label="Meta title"
            hint="≤ 70 characters. Falls back to the name when empty."
            error={fieldError("metaTitle")}
          >
            <AdminInput
              name="metaTitle"
              defaultValue={initial.metaTitle}
              maxLength={70}
              placeholder={name || "Category title for search"}
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

      <Panel
        title="Image"
        description="Used as this category's tile on the storefront. A clear, square-ish photo works best."
      >
        <SingleImagePicker
          name="imageId"
          defaultImageId={initial.imageId || null}
          defaultImageUrl={initial.imageUrl || null}
          label="Category image"
        />
      </Panel>

      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-border",
          "bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:rounded-2xl sm:border sm:px-5",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/categories")}
          className="min-h-11"
        >
          Cancel
        </Button>
        <SubmitButton pendingText={isEdit ? "Saving…" : "Creating…"}>
          <Save className="size-4" aria-hidden />
          {isEdit ? "Save category" : "Create category"}
        </SubmitButton>
      </div>
    </form>
  );
}
