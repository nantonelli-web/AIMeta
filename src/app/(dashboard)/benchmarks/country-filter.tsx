"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/context";

interface Country {
  code: string;
  name: string;
}

interface Props {
  /** Countries present in the workspace's competitor data, localized. */
  availableCountries: Country[];
  /** Current selection from the URL (empty = "all"). */
  activeCountryCodes: string[];
  channel: string;
  client: string | null;
  dateFrom: string;
  dateTo: string;
}

/**
 * Country filter popover — same visual grammar as BrandFilter so the two
 * feel part of the same taxonomy row. Switching countries clears the brand
 * subset because the available-brands list is derived from countries.
 */
export function CountryFilter({
  availableCountries,
  activeCountryCodes,
  channel,
  client,
  dateFrom,
  dateTo,
}: Props) {
  const router = useRouter();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set(activeCountryCodes));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPending(new Set(activeCountryCodes));
  }, [activeCountryCodes]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const total = availableCountries.length;
  const allSelected = pending.size === total && total > 0;
  const allCurrent = activeCountryCodes.length === total && total > 0;

  const filtered = useMemo(() => {
    if (!query.trim()) return availableCountries;
    const q = query.toLowerCase();
    return availableCountries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [query, availableCountries]);

  function toggle(code: string) {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function buildHref(countryCodes: string[]): string {
    const params = new URLSearchParams();
    params.set("channel", channel);
    if (client) params.set("client", client);
    // Country selection drives the brand list, so switching countries
    // invalidates any brand subset that was staged before.
    if (countryCodes.length !== total && countryCodes.length > 0) {
      params.set("countries", countryCodes.join(","));
    }
    params.set("from", dateFrom);
    params.set("to", dateTo);
    return `/benchmarks?${params.toString()}`;
  }

  function apply() {
    if (pending.size === 0) return;
    router.push(buildHref([...pending]));
    setOpen(false);
  }

  function resetPending() {
    setPending(new Set(activeCountryCodes));
  }

  const label = allCurrent || activeCountryCodes.length === 0
    ? t("benchmarks", "allCountries")
    : `${activeCountryCodes.length} ${t("benchmarks", "ofCountries")} ${total}`;

  const dirty =
    pending.size !== activeCountryCodes.length ||
    activeCountryCodes.some((c) => !pending.has(c));

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
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("benchmarks", "searchCountry")}
              className="h-8 text-xs pl-8"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {pending.size}/{total} {t("benchmarks", "countriesLabel")}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPending(new Set(availableCountries.map((c) => c.code)))}
                disabled={allSelected}
                className="text-gold hover:underline disabled:text-muted-foreground disabled:no-underline cursor-pointer disabled:cursor-default"
              >
                {t("benchmarks", "selectAllBrands")}
              </button>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={() => setPending(new Set())}
                disabled={pending.size === 0}
                className="text-gold hover:underline disabled:text-muted-foreground disabled:no-underline cursor-pointer disabled:cursor-default"
              >
                {t("benchmarks", "selectNoneBrands")}
              </button>
            </div>
          </div>

          <div className="max-h-[260px] overflow-y-auto border border-border rounded-md divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t("benchmarks", "noCountryMatch")}
              </p>
            ) : (
              filtered.map((c) => {
                const on = pending.has(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggle(c.code)}
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
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-6">{c.code}</span>
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })
            )}
          </div>

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
