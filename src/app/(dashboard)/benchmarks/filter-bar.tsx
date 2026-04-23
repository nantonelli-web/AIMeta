"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, RotateCcw, CalendarRange } from "lucide-react";
import { useT } from "@/lib/i18n/context";

interface Brand {
  id: string;
  name: string;
}

interface Props {
  /** Brands available under the current project filter. */
  availableBrands: Brand[];
  /** Currently selected subset (URL-driven). */
  activeBrandIds: string[];
  dateFrom: string;
  dateTo: string;
  /** Channel + project kept in sync when navigating. */
  channel: string;
  client: string | null;
}

/**
 * Secondary filter row: brand subset + date range. Chip + date inputs are
 * staged locally and flushed via Apply so we do not trigger a server
 * re-render on every keystroke.
 */
export function BenchmarkFilterBar({
  availableBrands,
  activeBrandIds,
  dateFrom,
  dateTo,
  channel,
  client,
}: Props) {
  const router = useRouter();
  const { t } = useT();

  const [selected, setSelected] = useState<Set<string>>(new Set(activeBrandIds));
  const [from, setFrom] = useState(dateFrom);
  const [to, setTo] = useState(dateTo);

  const allIds = useMemo(() => availableBrands.map((b) => b.id), [availableBrands]);
  const allSelected = selected.size === allIds.length;

  const dirty =
    from !== dateFrom ||
    to !== dateTo ||
    selected.size !== activeBrandIds.length ||
    activeBrandIds.some((id) => !selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  function buildHref(brandIds: string[], f: string, tt: string): string {
    const params = new URLSearchParams();
    params.set("channel", channel);
    if (client) params.set("client", client);
    // Only serialise the brand list when it differs from "all" — keeps URLs clean.
    if (brandIds.length !== availableBrands.length && brandIds.length > 0) {
      params.set("brands", brandIds.join(","));
    }
    params.set("from", f);
    params.set("to", tt);
    return `/benchmarks?${params.toString()}`;
  }

  function apply() {
    if (!from || !to || from > to) return;
    router.push(buildHref([...selected], from, to));
  }

  function reset() {
    setSelected(new Set(allIds));
    const today = new Date();
    const ago = new Date(today);
    ago.setDate(today.getDate() - 30);
    const f = ago.toISOString().slice(0, 10);
    const tt = today.toISOString().slice(0, 10);
    setFrom(f);
    setTo(tt);
    router.push(buildHref(allIds, f, tt));
  }

  const rangeInvalid = !from || !to || from > to;

  return (
    <div className="space-y-3 print:hidden">
      {/* Date range + actions */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <CalendarRange className="size-4 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {t("benchmarks", "analysisRange")}
          </span>
        </div>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="text-xs h-8 w-36"
        />
        <span className="text-muted-foreground text-xs">—</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="text-xs h-8 w-36"
        />
        {rangeInvalid && (
          <span className="text-[11px] text-red-500">{t("benchmarks", "rangeInvalid")}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={reset}
            variant="outline"
            size="sm"
            className="h-8 text-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            {t("benchmarks", "resetFilters")}
          </Button>
          <Button
            onClick={apply}
            disabled={!dirty || rangeInvalid}
            size="sm"
            className="h-8 text-xs cursor-pointer"
          >
            <Check className="size-3.5" />
            {t("benchmarks", "apply")}
          </Button>
        </div>
      </div>

      {/* Brand multi-select chips */}
      {availableBrands.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mr-1">
            {t("benchmarks", "filterByBrand")}
          </span>
          <button
            type="button"
            onClick={toggleAll}
            className={
              allSelected
                ? "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gold/15 text-gold border border-gold/30 transition-colors cursor-pointer"
                : "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            }
          >
            {allSelected ? t("benchmarks", "allBrandsSelected") : t("benchmarks", "selectAllBrands")}
          </button>
          {availableBrands.map((b) => {
            const on = selected.has(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggle(b.id)}
                className={
                  on
                    ? "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gold/10 text-gold border border-gold/30 transition-colors cursor-pointer"
                    : "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                }
              >
                {b.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
