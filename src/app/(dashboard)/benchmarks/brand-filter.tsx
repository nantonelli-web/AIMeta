"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/context";

interface Brand {
  id: string;
  name: string;
}

interface Props {
  availableBrands: Brand[];
  activeBrandIds: string[];
  channel: string;
  client: string | null;
  countries: string[]; // preserved when brand subset changes
  dateFrom: string;
  dateTo: string;
  totalCountries: number;
  /** Preserved through buildHref so applying a brand pick does not
   *  silently drop the user's Active/Inactive narrowing. */
  status: "active" | "inactive" | null;
}

/**
 * Popover-based brand filter: scales to many brands via search + scroll,
 * keeps URL in sync once the user clicks Apply. The displayed trigger label
 * always reflects the URL-confirmed selection, not the pending in-popover state.
 */
export function BrandFilter({
  availableBrands,
  activeBrandIds,
  channel,
  client,
  countries,
  dateFrom,
  dateTo,
  totalCountries,
  status,
}: Props) {
  const router = useRouter();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set(activeBrandIds));
  const rootRef = useRef<HTMLDivElement>(null);

  // Reset pending state whenever the URL-driven selection changes (e.g. after
  // Apply). Without this the popover would drift from the live URL.
  useEffect(() => {
    setPending(new Set(activeBrandIds));
  }, [activeBrandIds]);

  // Close popover on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const total = availableBrands.length;
  const allSelected = pending.size === total && total > 0;
  const allCurrent = activeBrandIds.length === total && total > 0;

  const filtered = useMemo(() => {
    if (!query.trim()) return availableBrands;
    const q = query.toLowerCase();
    return availableBrands.filter((b) => b.name.toLowerCase().includes(q));
  }, [query, availableBrands]);

  function toggle(id: string) {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setPending(new Set(availableBrands.map((b) => b.id)));
  }
  function selectNone() {
    setPending(new Set());
  }

  function buildHref(brandIds: string[]): string {
    const params = new URLSearchParams();
    params.set("channel", channel);
    if (client) params.set("client", client);
    if (countries.length !== totalCountries && countries.length > 0) {
      params.set("countries", countries.join(","));
    }
    if (brandIds.length !== total && brandIds.length > 0) {
      params.set("brands", brandIds.join(","));
    }
    params.set("from", dateFrom);
    params.set("to", dateTo);
    if (status) params.set("status", status);
    return `/benchmarks?${params.toString()}`;
  }

  function apply() {
    if (pending.size === 0) return; // guard: empty selection meaningless
    router.push(buildHref([...pending]));
    setOpen(false);
  }

  function resetPending() {
    setPending(new Set(activeBrandIds));
  }

  const label = allCurrent
    ? t("benchmarks", "allBrandsSelected")
    : `${activeBrandIds.length} ${t("benchmarks", "ofBrands")} ${total}`;

  const dirty =
    pending.size !== activeBrandIds.length ||
    activeBrandIds.some((id) => !pending.has(id));

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-border text-foreground hover:bg-muted transition-colors cursor-pointer min-w-[180px] justify-between"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-30 w-80 rounded-lg border border-border bg-card shadow-lg p-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("benchmarks", "searchBrand")}
              className="h-8 text-xs pl-8"
            />
          </div>

          {/* Select all / none */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {pending.size}/{total} {t("benchmarks", "brandsLabel")}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                disabled={allSelected}
                className="text-gold hover:underline disabled:text-muted-foreground disabled:no-underline cursor-pointer disabled:cursor-default"
              >
                {t("benchmarks", "selectAllBrands")}
              </button>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={selectNone}
                disabled={pending.size === 0}
                className="text-gold hover:underline disabled:text-muted-foreground disabled:no-underline cursor-pointer disabled:cursor-default"
              >
                {t("benchmarks", "selectNoneBrands")}
              </button>
            </div>
          </div>

          {/* Checkbox list */}
          <div className="max-h-[260px] overflow-y-auto border border-border rounded-md divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t("benchmarks", "noBrandMatch")}
              </p>
            ) : (
              filtered.map((b) => {
                const on = pending.has(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggle(b.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                      on ? "bg-gold/5 text-gold hover:bg-gold/10" : "hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`size-4 rounded border flex items-center justify-center shrink-0 ${
                        on ? "bg-gold border-gold text-gold-foreground" : "border-border bg-background"
                      }`}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="truncate">{b.name}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {dirty && (
              <button
                type="button"
                onClick={resetPending}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
                {t("benchmarks", "undo")}
              </button>
            )}
            <button
              type="button"
              onClick={apply}
              disabled={!dirty || pending.size === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-gold text-gold-foreground hover:bg-gold/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              <Check className="size-3.5" />
              {t("benchmarks", "apply")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
