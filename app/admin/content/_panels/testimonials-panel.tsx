import { Quote, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/admin/panel";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { EditorSheet } from "../_components/editor-sheet";
import { TestimonialEditorForm } from "../_components/testimonial-editor";
import { QuickToggle } from "../_components/quick-toggle";
import { ReorderControls } from "../_components/reorder-controls";
import {
  moderateTestimonial,
  featureTestimonial,
  reorderTestimonials,
  deleteTestimonial,
} from "../_actions/testimonials";

/**
 * Testimonials tab (doc 15 §4.4) — a moderation queue: unapproved first (amber),
 * then approved. One-tap Approve + Feature, reorder, edit, delete. Warns when
 * zero are approved (the homepage section self-hides, doc 05 §7).
 */
export async function TestimonialsPanel() {
  const testimonials = await prisma.testimonial.findMany({
    // Unapproved first, then by display order.
    orderBy: [{ isApproved: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      customerName: true,
      location: true,
      rating: true,
      text: true,
      imageId: true,
      isApproved: true,
      isFeatured: true,
      sortOrder: true,
    },
  });

  const approvedCount = testimonials.filter((t) => t.isApproved).length;
  const featuredCount = testimonials.filter((t) => t.isApproved && t.isFeatured).length;
  const ids = testimonials.map((t) => t.id);

  return (
    <Panel
      title="Testimonials"
      description={`${approvedCount} approved · ${featuredCount} featured`}
      action={
        <EditorSheet title="Add testimonial" triggerLabel="Add" triggerIcon="add" triggerVariant="default">
          <TestimonialEditorForm />
        </EditorSheet>
      }
    >
      {testimonials.length === 0 ? (
        <EmptyState
          icon={<Quote className="size-6" />}
          title="No testimonials yet"
          description="Paste a happy customer's words, then approve and feature them."
        />
      ) : (
        <>
          {approvedCount === 0 ? (
            <p className="mb-3 rounded-xl bg-accent/40 px-3 py-2 text-xs text-accent-foreground">
              No testimonials are approved yet, so the homepage testimonials section is
              hidden. Approve at least one to show it.
            </p>
          ) : null}

          <ul className="space-y-2">
            {testimonials.map((t, index) => (
              <li
                key={t.id}
                className={`rounded-2xl border p-3 ${
                  t.isApproved ? "border-border" : "border-accent/60 bg-accent/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  {t.isApproved ? (
                    <ReorderControls ids={ids} index={index} action={reorderTestimonials} />
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">“{t.text}”</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{t.customerName}</span>
                      {t.location ? <span>· {t.location}</span> : null}
                      {t.rating ? (
                        <span className="inline-flex items-center text-primary" aria-label={`${t.rating} stars`}>
                          {Array.from({ length: t.rating }).map((_, i) => (
                            <Star key={i} className="size-3 fill-current" />
                          ))}
                        </span>
                      ) : null}
                      {!t.isApproved ? <StatusBadge tone="warning" label="Pending" /> : null}
                      {t.isApproved && t.isFeatured ? <StatusBadge tone="success" label="Featured" /> : null}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
                  <QuickToggle
                    id={t.id}
                    checked={t.isApproved}
                    action={moderateTestimonial}
                    label="Approved"
                  />
                  <QuickToggle
                    id={t.id}
                    checked={t.isFeatured}
                    action={featureTestimonial}
                    label="Featured"
                    disabled={!t.isApproved}
                  />
                  <div className="ml-auto flex items-center gap-2">
                    <EditorSheet title="Edit testimonial" triggerLabel="Edit" triggerIcon="edit">
                      <TestimonialEditorForm
                        data={{
                          id: t.id,
                          customerName: t.customerName,
                          location: t.location,
                          rating: t.rating,
                          text: t.text,
                          imageId: t.imageId,
                          sortOrder: t.sortOrder,
                        }}
                      />
                    </EditorSheet>
                    <ConfirmButton
                      action={deleteTestimonial}
                      hiddenFields={{ id: t.id }}
                      title="Delete this testimonial?"
                      confirmLabel="Delete"
                      size="icon-sm"
                      aria-label="Delete testimonial"
                    >
                      ✕
                    </ConfirmButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
