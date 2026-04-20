"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import { MetaIcon } from "@/components/ui/meta-icon";

interface Initial {
  q?: string;
  platform?: string;
  cta?: string;
  status?: string;
  format?: string;
  channel?: string;
  brand?: string;
}

export function LibraryFilters({
  initial,
  ctas,
  platforms,
  statuses,
  competitors,
}: {
  initial: Initial;
  ctas: string[];
  platforms: string[];
  statuses: string[];
  competitors: { id: string; page_name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q ?? "");
  const { t } = useT();

  useEffect(() => {
    setQ(initial.q ?? "");
  }, [initial.q]);

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && value.length > 0) next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      router.push(`/library?${next.toString()}`);
    });
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    update("q", q.trim() || null);
  }

  function clearAll() {
    setQ("");
    startTransition(() => router.push("/library"));
  }

  const hasFilters =
    initial.q || initial.platform || initial.cta || initial.status || initial.format || initial.channel || initial.brand;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form onSubmit={onSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-lg">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("library", "searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {t("library", "searchBtn")}
        </Button>
        {hasFilters && (
          <Button type="button" variant="outline" onClick={clearAll}>
            <X className="size-4" /> Reset
          </Button>
        )}
      </form>

      {/* Filter groups in a card-style container */}
      <div className="rounded-lg border border-border bg-card p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Channel filter */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">
            {t("library", "filterChannel")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {([
              { value: "", label: t("library", "allChannels"), icon: null as React.ReactNode },
              { value: "meta", label: "Meta Ads", icon: <MetaIcon className="size-3.5 mr-1" /> },
              { value: "google", label: "Google Ads", icon: <GoogleIcon className="size-3.5 mr-1" /> },
            ]).map((o) => {
              const active = (initial.channel ?? "") === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => update("channel", o.value || null)}
                  className={cn(
                    "inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                    active
                      ? "bg-gold/15 text-gold border-gold/40 font-medium"
                      : "bg-muted/50 border-border text-muted-foreground hover:border-gold/30 hover:text-foreground"
                  )}
                >
                  {o.icon}
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Brand filter */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">
            {t("library", "filterBrand")}
          </p>
          <select
            value={initial.brand ?? ""}
            onChange={(e) => update("brand", e.target.value || null)}
            className="w-full rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/40"
          >
            <option value="">{t("library", "allBrands")}</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.page_name}
              </option>
            ))}
          </select>
        </div>

        <FilterGroup
          label={t("library", "formatLabel")}
          options={[
            { value: "image", label: t("library", "formatImage") },
            { value: "video", label: t("library", "formatVideo") },
          ]}
          value={initial.format}
          onChange={(v) => update("format", v)}
        />
        {platforms.length > 0 && (
          <FilterGroup
            label={t("library", "platformLabel")}
            options={platforms.map((p) => ({ value: p, label: p }))}
            value={initial.platform}
            onChange={(v) => update("platform", v)}
          />
        )}
        {ctas.length > 0 && (
          <FilterGroup
            label={t("library", "ctaLabel")}
            options={ctas.slice(0, 8).map((c) => ({ value: c, label: c }))}
            value={initial.cta}
            onChange={(v) => update("cta", v)}
          />
        )}
        {statuses.length > 0 && (
          <FilterGroup
            label={t("library", "statusLabel")}
            options={statuses.map((s) => ({ value: s, label: s }))}
            value={initial.status}
            onChange={(v) => update("status", v)}
          />
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(active ? null : o.value)}
              className={cn(
                "inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                active
                  ? "bg-gold/15 text-gold border-gold/40 font-medium"
                  : "bg-muted/50 border-border text-muted-foreground hover:border-gold/30 hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 1 7.07 17.07" />
      <path d="M13.5 12H8m5.5 0h2.5v-2" />
    </svg>
  );
}
