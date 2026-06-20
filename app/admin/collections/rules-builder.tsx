"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSelect, AdminInput } from "@/components/admin/form-field";
import { rupeesToPaise, paiseToRupees } from "@/lib/money";
import { OCCASIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  RULE_FIELDS,
  RULE_OPS,
  type CollectionRules,
  type RuleCondition,
} from "./schema";

/**
 * Automated-collection rules builder (docs/11 §3.10 FR-40/42 — **V1**). An
 * accessible ALL/ANY toggle plus add/remove condition rows over
 * `field ∈ {category|tag|occasion|price|isBestseller|isFeatured}` and
 * `op ∈ {eq|in|lte|gte}`. Price values are entered in **₹** and stored as integer
 * **paise** in the rule. This UI only *captures* rules; membership materializes
 * server-side when the automation flag ships (recompute is a stub for now).
 *
 * Note: this is a controlled component owned by the collection form; the parsed
 * `CollectionRules` value is submitted as part of the upsert payload (not via a
 * native form field), so it stays a plain JS object.
 */

const FIELD_LABEL: Record<(typeof RULE_FIELDS)[number], string> = {
  category: "Category (slug)",
  tag: "Tag",
  occasion: "Occasion",
  price: "Price (₹)",
  isBestseller: "Is bestseller",
  isFeatured: "Is featured",
};

const OP_LABEL: Record<(typeof RULE_OPS)[number], string> = {
  eq: "is",
  in: "is any of",
  lte: "≤",
  gte: "≥",
};

const BOOLEAN_FIELDS = new Set(["isBestseller", "isFeatured"]);
const NUMERIC_FIELDS = new Set(["price"]);

/** A sensible default condition when a new row is added. */
function blankCondition(): RuleCondition {
  return { field: "tag", op: "eq", value: "" };
}

export function RulesBuilder({
  value,
  onChange,
  error,
}: {
  value: CollectionRules;
  onChange: (next: CollectionRules) => void;
  error?: string;
}) {
  const update = (patch: Partial<CollectionRules>) => onChange({ ...value, ...patch });

  const setCondition = (index: number, next: RuleCondition) => {
    const conditions = value.conditions.map((c, i) => (i === index ? next : c));
    update({ conditions });
  };

  const addCondition = () => update({ conditions: [...value.conditions, blankCondition()] });

  const removeCondition = (index: number) =>
    update({ conditions: value.conditions.filter((_, i) => i !== index) });

  return (
    <fieldset className="space-y-3 rounded-xl border border-border bg-muted/20 p-3 sm:p-4">
      <legend className="px-1 text-sm font-medium text-foreground">
        Automated rules
      </legend>

      <p className="rounded-lg bg-accent/40 px-3 py-2 text-xs text-accent-foreground">
        Heads up: automated membership runs in a later release. Rules are saved now
        so the collection auto-fills once it&apos;s switched on.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Match</span>
        <AdminSelect
          aria-label="Match all or any"
          value={value.match}
          onChange={(e) => update({ match: e.target.value as CollectionRules["match"] })}
          className="h-9 w-auto"
        >
          <option value="all">all</option>
          <option value="any">any</option>
        </AdminSelect>
        <span className="text-muted-foreground">of these conditions:</span>
      </div>

      <ul className="space-y-2">
        {value.conditions.map((condition, i) => (
          <li
            key={i}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-2.5"
          >
            <ConditionRow
              condition={condition}
              onChange={(next) => setCondition(i, next)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeCondition(i)}
              aria-label={`Remove condition ${i + 1}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="button" variant="outline" size="sm" onClick={addCondition} className="min-h-9">
        <Plus className="size-4" aria-hidden />
        Add condition
      </Button>
    </fieldset>
  );
}

function ConditionRow({
  condition,
  onChange,
}: {
  condition: RuleCondition;
  onChange: (next: RuleCondition) => void;
}) {
  const isBoolean = BOOLEAN_FIELDS.has(condition.field);
  const isNumeric = NUMERIC_FIELDS.has(condition.field);

  // When the field type changes, coerce value + op into a valid shape.
  const changeField = (field: RuleCondition["field"]) => {
    if (BOOLEAN_FIELDS.has(field)) {
      onChange({ field, op: "eq", value: true });
    } else if (NUMERIC_FIELDS.has(field)) {
      onChange({ field, op: "lte", value: 0 });
    } else {
      onChange({ field, op: "eq", value: "" });
    }
  };

  return (
    <div className="flex flex-1 flex-wrap items-end gap-2">
      <label className="flex min-w-32 flex-1 flex-col gap-1">
        <span className="sr-only">Field</span>
        <AdminSelect
          value={condition.field}
          onChange={(e) => changeField(e.target.value as RuleCondition["field"])}
          className="h-9"
        >
          {RULE_FIELDS.map((f) => (
            <option key={f} value={f}>
              {FIELD_LABEL[f]}
            </option>
          ))}
        </AdminSelect>
      </label>

      {!isBoolean ? (
        <label className="flex w-24 flex-col gap-1">
          <span className="sr-only">Operator</span>
          <AdminSelect
            value={condition.op}
            onChange={(e) => onChange({ ...condition, op: e.target.value as RuleCondition["op"] })}
            className="h-9"
          >
            {(isNumeric ? (["lte", "gte"] as const) : (["eq", "in"] as const)).map((op) => (
              <option key={op} value={op}>
                {OP_LABEL[op]}
              </option>
            ))}
          </AdminSelect>
        </label>
      ) : null}

      <div className={cn("flex flex-col gap-1", isBoolean ? "w-28" : "min-w-32 flex-1")}>
        <span className="sr-only">Value</span>
        <ValueInput condition={condition} onChange={onChange} />
      </div>
    </div>
  );
}

function ValueInput({
  condition,
  onChange,
}: {
  condition: RuleCondition;
  onChange: (next: RuleCondition) => void;
}) {
  if (BOOLEAN_FIELDS.has(condition.field)) {
    const current = condition.value === true ? "true" : "false";
    return (
      <AdminSelect
        value={current}
        onChange={(e) => onChange({ ...condition, value: e.target.value === "true" })}
        className="h-9"
        aria-label="Value"
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </AdminSelect>
    );
  }

  if (NUMERIC_FIELDS.has(condition.field)) {
    const rupees =
      typeof condition.value === "number" ? paiseToRupees(condition.value) : 0;
    return (
      <AdminInput
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={Number.isFinite(rupees) ? rupees : 0}
        onChange={(e) =>
          onChange({ ...condition, value: rupeesToPaise(Number(e.target.value || 0)) })
        }
        className="h-9"
        aria-label="Value in rupees"
      />
    );
  }

  // occasion → suggest from the curated vocabulary; tag/category → free text.
  if (condition.field === "occasion") {
    const single = Array.isArray(condition.value)
      ? (condition.value[0] ?? "")
      : String(condition.value ?? "");
    const asValue = (v: string): RuleCondition["value"] =>
      condition.op === "in" ? [v] : v;
    return (
      <AdminSelect
        value={single}
        onChange={(e) => onChange({ ...condition, value: asValue(e.target.value) })}
        className="h-9"
        aria-label="Occasion"
      >
        <option value="" disabled>
          Select…
        </option>
        {OCCASIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </AdminSelect>
    );
  }

  // tag / category (slug) — free text. For `in`, accept a comma list.
  const text = Array.isArray(condition.value)
    ? condition.value.join(", ")
    : String(condition.value ?? "");
  return (
    <AdminInput
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        const next: RuleCondition["value"] =
          condition.op === "in"
            ? raw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : raw;
        onChange({ ...condition, value: next });
      }}
      placeholder={condition.field === "category" ? "category-slug" : "tag"}
      className="h-9"
      aria-label="Value"
    />
  );
}
