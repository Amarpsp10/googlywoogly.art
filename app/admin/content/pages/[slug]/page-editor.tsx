"use client";

import * as React from "react";
import {
  FormField,
  AdminInput,
  AdminTextarea,
} from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { Panel } from "@/components/admin/panel";
import {
  ActionForm,
  useFieldError,
} from "../../_components/action-form";
import { SwitchField } from "../../_components/switch-field";
import { upsertCmsPage } from "../../_actions/pages";

/**
 * `CmsPageEditor` — the full-screen CMS page editor (doc 15 §4.6). Title (the
 * page `<h1>`), rich body (sanitized server-side), an SEO accordion with char
 * counters + a live SERP-ish preview (FR-36), a Published switch, and the
 * optimistic-concurrency `expectedUpdatedAt` stale-guard (FR-25). Legal pages can
 * pre-fill a standard outline when the body is empty (FR-37).
 */

export interface CmsPageEditorData {
  id?: string;
  slug: string;
  title: string;
  bodyRich: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  isPublished: boolean;
  updatedAt?: string;
}

export function CmsPageEditor({
  data,
  defaultTemplate,
}: {
  data: CmsPageEditorData;
  /** Standard outline body inserted when the editor body is empty (FR-37). */
  defaultTemplate?: string;
}) {
  const titleError = useFieldError("title");
  const bodyError = useFieldError("bodyRich");
  const slugError = useFieldError("slug");

  const [title, setTitle] = React.useState(data.title);
  const [body, setBody] = React.useState(data.bodyRich);
  const [metaTitle, setMetaTitle] = React.useState(data.metaTitle ?? "");
  const [metaDesc, setMetaDesc] = React.useState(data.metaDescription ?? "");

  const insertTemplate = () => {
    if (defaultTemplate && !body.trim()) setBody(defaultTemplate);
  };

  return (
    <Panel>
      <ActionForm action={upsertCmsPage}>
        <input type="hidden" name="slug" value={data.slug} />
        {data.id ? <input type="hidden" name="id" value={data.id} /> : null}
        {data.updatedAt ? (
          <input type="hidden" name="expectedUpdatedAt" value={data.updatedAt} />
        ) : null}

        {/* Slug is shown read-only (reserved set); editing requires intent. */}
        <FormField label="Slug" error={slugError} hint="Fixed route — changing it writes a 301 redirect.">
          <AdminInput name="slug" defaultValue={data.slug} readOnly className="bg-muted/40" />
        </FormField>

        <FormField label="Title" required error={titleError} hint="Shown as the page heading (H1).">
          <AdminInput
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={160}
          />
        </FormField>

        <FormField
          label="Body"
          required
          error={bodyError}
          hint="Basic HTML allowed (h2/h3, bold, lists, links). Sanitized on save."
        >
          <AdminTextarea
            name="bodyRich"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="font-mono text-xs leading-relaxed"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{body.length} characters</span>
            {defaultTemplate && !body.trim() ? (
              <button
                type="button"
                onClick={insertTemplate}
                className="text-xs font-medium text-primary hover:underline"
              >
                Insert standard template
              </button>
            ) : null}
          </div>
        </FormField>

        {/* SEO accordion (FR-36) */}
        <details className="rounded-xl border border-border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            SEO settings
          </summary>
          <div className="mt-3 space-y-3">
            <FormField
              label="Meta title"
              hint={`${metaTitle.length}/60 — falls back to the page title when empty.`}
            >
              <AdminInput
                name="metaTitle"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                maxLength={60}
              />
            </FormField>
            <FormField
              label="Meta description"
              hint={`${metaDesc.length}/155 — shown in search results.`}
            >
              <AdminTextarea
                name="metaDescription"
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
                rows={2}
                maxLength={155}
              />
            </FormField>

            {/* Lightweight SERP preview. */}
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="truncate text-sm text-[#1a0dab]">{metaTitle || title || "Page title"}</p>
              <p className="truncate text-xs text-emerald-700">googlywoogly.art/{data.slug}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {metaDesc || "Your meta description preview appears here."}
              </p>
            </div>
          </div>
        </details>

        <SwitchField
          name="isPublished"
          label="Published"
          description="When off, the storefront shows the default text for this page."
          defaultChecked={data.isPublished}
        />

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <SubmitButton pendingText="Saving…">Save page</SubmitButton>
        </div>
      </ActionForm>
    </Panel>
  );
}
