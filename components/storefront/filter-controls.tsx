"use client";

import { useCallback, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { CATALOG_SORTS, AVAILABILITY_VALUES, type CatalogSort } from "@/lib/validations/catalog";
import { INVENTORY_STATE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<CatalogSort, string> = {
  featured: "Featured",
  newest: "Newest",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  bestselling: "Bestselling",
};

interface FacetOption {
  value: string;
  label: string;
}

export interface FilterProps {
  categories?: FacetOption[];
  collections?: FacetOption[];
  className?: string;
}

function useFacetToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const push = useCallback(
    (params: URLSearchParams) => {
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const toggle = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      const current = (params.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const set = new Set(current);
      set.has(value) ? set.delete(value) : set.add(value);
      const next = [...set].sort();
      if (next.length) params.set(key, next.join(","));
      else params.delete(key);
      push(params);
    },
    [sp, push],
  );

  const isActive = useCallback(
    (key: string, value: string) =>
      (sp.get(key) ?? "").split(",").map((s) => s.trim()).includes(value),
    [sp],
  );

  return { toggle, isActive, sp, push };
}

function FacetGroup({
  title,
  facetKey,
  options,
}: {
  title: string;
  facetKey: string;
  options: FacetOption[];
}) {
  const { toggle, isActive } = useFacetToggle();
  if (options.length === 0) return null;
  return (
    <div className="border-b border-border py-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = isActive(facetKey, opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(facetKey, opt.value)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-pastel-pink/20",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PriceFilter() {
  const { sp, push } = useFacetToggle();
  const existing = (sp.get("price") ?? "").split("-");
  const [min, setMin] = useState(existing[0] ?? "");
  const [max, setMax] = useState(existing[1] ?? "");

  function apply() {
    const params = new URLSearchParams(sp.toString());
    if (min || max) params.set("price", `${min}-${max}`);
    else params.delete("price");
    push(params);
  }

  return (
    <div className="border-b border-border py-5">
      <h3 className="mb-3 font-semibold">Price (₹)</h3>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="Min"
          className="w-full rounded-lg border border-border bg-input/40 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          aria-label="Minimum price"
        />
        <span className="text-muted-foreground">–</span>
        <input
          type="number"
          inputMode="numeric"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          placeholder="Max"
          className="w-full rounded-lg border border-border bg-input/40 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          aria-label="Maximum price"
        />
      </div>
      <Button onClick={apply} size="sm" variant="outline" className="mt-3 w-full rounded-full">
        Apply
      </Button>
    </div>
  );
}

const AVAILABILITY_OPTIONS: FacetOption[] = AVAILABILITY_VALUES.map((v) => ({
  value: v,
  label: INVENTORY_STATE[v].label,
}));

/** The full filter panel (used in the desktop sidebar and the mobile drawer). */
export function CatalogFilters({ categories, collections, className }: FilterProps) {
  const { sp, push } = useFacetToggle();
  const hasActive = ["category", "collection", "availability", "price", "occasion", "material"].some(
    (k) => sp.get(k),
  );
  function clearAll() {
    const params = new URLSearchParams(sp.toString());
    ["category", "collection", "availability", "price", "occasion", "material"].forEach((k) =>
      params.delete(k),
    );
    push(params);
  }
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-bold">Filters</h2>
        {hasActive && (
          <button onClick={clearAll} className="text-sm text-primary hover:underline">
            Clear all
          </button>
        )}
      </div>
      {categories && categories.length > 0 && (
        <FacetGroup title="Category" facetKey="category" options={categories} />
      )}
      {collections && collections.length > 0 && (
        <FacetGroup title="Collection" facetKey="collection" options={collections} />
      )}
      <FacetGroup title="Availability" facetKey="availability" options={AVAILABILITY_OPTIONS} />
      <PriceFilter />
    </div>
  );
}

/** Sort dropdown. */
export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = (sp.get("sort") as CatalogSort) || "featured";
  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(sp.toString());
    const v = e.target.value;
    if (v === "featured") params.delete("sort");
    else params.set("sort", v);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  return (
    <select
      value={current}
      onChange={onChange}
      aria-label="Sort products"
      className="rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    >
      {CATALOG_SORTS.map((s) => (
        <option key={s} value={s}>
          {SORT_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

/** Mobile "Filters" button that opens a slide-over with the same panel. */
export function MobileFilters(props: FilterProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={props.className}>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="size-4" /> Filters
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-serif text-lg font-bold">Filters</span>
              <button onClick={() => setOpen(false)} aria-label="Close filters" className="rounded-full p-2 hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>
            <CatalogFilters categories={props.categories} collections={props.collections} />
            <Button className="mt-4 w-full rounded-full" onClick={() => setOpen(false)}>
              Show results
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
