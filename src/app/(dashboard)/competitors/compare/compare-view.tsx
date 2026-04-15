"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Pen, Palette, Loader2, AlertCircle, Target, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import { AnalysisReport } from "./analysis-report";
import type { CreativeAnalysisResult } from "@/lib/ai/creative-analysis";
import type { MaitCompetitor } from "@/types";

type Tab = "technical" | "copy" | "visual";

interface CompStats {
  id: string;
  name: string;
  totalAds: number;
  activeAds: number;
  imageCount: number;
  videoCount: number;
  topCtas: { name: string; count: number }[];
  platforms: { name: string; count: number }[];
  avgDuration: number;
  avgCopyLength: number;
  adsPerWeek: number;
  objectiveInference: {
    objective: string;
    confidence: number;
    signals: string[];
  };
  latestAds: {
    headline: string | null;
    image_url: string | null;
    ad_archive_id: string;
  }[];
}

export function CompareView({
  competitors,
}: {
  competitors: MaitCompetitor[];
  workspaceId: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<Tab>("technical");

  // Technical data
  const [stats, setStats] = useState<CompStats[] | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // AI analysis
  const [aiResult, setAiResult] = useState<CreativeAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiLoadedForRef = useRef<string>("");

  const { t, locale } = useT();
  const selectedIds = [...selected];
  const selectedKey = selectedIds.sort().join(",");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
    // Reset AI when selection changes
    setAiResult(null);
    setAiError(null);
    aiLoadedForRef.current = "";
  }

  // Fetch technical stats when selection changes
  useEffect(() => {
    if (selected.size < 2) {
      setStats(null);
      return;
    }
    setStatsLoading(true);
    fetch("/api/competitors/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    })
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [selectedKey]);

  // Auto-launch AI when copy or visual tab is selected
  useEffect(() => {
    if (
      (activeTab === "copy" || activeTab === "visual") &&
      selected.size >= 2 &&
      !aiResult &&
      !aiLoading &&
      aiLoadedForRef.current !== selectedKey
    ) {
      aiLoadedForRef.current = selectedKey;
      setAiLoading(true);
      setAiError(null);
      fetch("/api/ai/creative-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ competitor_ids: selectedIds, locale }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setAiError(data.error ?? t("creativeAnalysis", "analysisFailed"));
            return;
          }
          const data: CreativeAnalysisResult = await res.json();
          setAiResult(data);
        })
        .catch(() => setAiError(t("creativeAnalysis", "analysisFailed")))
        .finally(() => setAiLoading(false));
    }
  }, [activeTab, selectedKey]);

  const hasResults = selected.size >= 2;

  return (
    <div className="space-y-6">
      {/* Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {t("compare", "selectCompetitors")} ({selected.size}/3)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {competitors.map((c) => {
              const isSelected = selected.has(c.id);
              return (
                <Button
                  key={c.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggle(c.id)}
                  disabled={!isSelected && selected.size >= 3}
                >
                  {c.page_name}
                </Button>
              );
            })}
          </div>
          {competitors.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("compare", "noCompetitorsInWorkspace")}
            </p>
          )}
        </CardContent>
      </Card>

      {!hasResults && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("compare", "selectAtLeast2")}
        </p>
      )}

      {/* Tabs */}
      {hasResults && (
        <>
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
            <TabButton
              active={activeTab === "technical"}
              onClick={() => setActiveTab("technical")}
              icon={<BarChart3 className="size-3.5" />}
              label={t("compare", "tabTechnical")}
            />
            <TabButton
              active={activeTab === "copy"}
              onClick={() => setActiveTab("copy")}
              icon={<Pen className="size-3.5" />}
              label={t("compare", "tabCopy")}
              loading={aiLoading && activeTab === "copy"}
            />
            <TabButton
              active={activeTab === "visual"}
              onClick={() => setActiveTab("visual")}
              icon={<Palette className="size-3.5" />}
              label={t("compare", "tabVisual")}
              loading={aiLoading && activeTab === "visual"}
            />
          </div>

          {/* Technical Tab */}
          {activeTab === "technical" && (
            statsLoading ? (
              <LoadingState text={t("compare", "calculating")} />
            ) : stats && stats.length >= 2 ? (
              <div className="space-y-4">
                <CompareTable label={t("compare", "totalAds")} stats={stats} render={(s) => String(s.totalAds)} />
                <CompareTable label={t("compare", "activeAds")} stats={stats} render={(s) => String(s.activeAds)} highlight />

                {/* Estimated Campaign Objective */}
                <ObjectiveCard stats={stats} t={t} />

                <CompareTable
                  label={t("compare", "formatMix")}
                  stats={stats}
                  render={(s) => {
                    const total = s.imageCount + s.videoCount;
                    if (total === 0) return "\u2014";
                    const imgPct = Math.round((s.imageCount / total) * 100);
                    return `${imgPct}% img \u00B7 ${100 - imgPct}% video`;
                  }}
                />
                <CompareTable
                  label={t("compare", "topCta")}
                  stats={stats}
                  render={(s) => s.topCtas.slice(0, 3).map((c) => c.name).join(", ") || "\u2014"}
                />
                <CompareTable
                  label={t("compare", "platformsLabel")}
                  stats={stats}
                  render={(s) => s.platforms.map((p) => p.name).join(", ") || "\u2014"}
                />
                <CompareTable
                  label={t("compare", "avgDuration")}
                  stats={stats}
                  render={(s) => s.avgDuration > 0 ? `${s.avgDuration} ${t("compare", "avgDurationDays")}` : "\u2014"}
                />
                <CompareTable
                  label={t("compare", "avgCopyLength")}
                  stats={stats}
                  render={(s) => s.avgCopyLength > 0 ? `${s.avgCopyLength} ${t("compare", "avgCopyChars")}` : "\u2014"}
                />
                <CompareTable
                  label={t("compare", "refreshRate")}
                  stats={stats}
                  render={(s) => s.adsPerWeek > 0 ? `${s.adsPerWeek} ${t("compare", "adsPerWeek")}` : "\u2014"}
                  highlight
                />
                {/* Latest ads */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{t("compare", "latestAds")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={cn("grid gap-4", stats.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                      {stats.map((s) => (
                        <div key={s.id} className="space-y-3">
                          <p className="text-xs font-medium text-gold">{s.name}</p>
                          {s.latestAds.slice(0, 3).map((ad) => (
                            <a
                              key={ad.ad_archive_id}
                              href={`https://www.facebook.com/ads/library/?id=${ad.ad_archive_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-lg border border-border overflow-hidden hover:border-gold/40 transition-colors"
                            >
                              {ad.image_url && !ad.image_url.includes("/render_ad/") ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={ad.image_url} alt="" className="w-full aspect-video object-cover" />
                              ) : (
                                <div className="aspect-video bg-muted grid place-items-center text-xs text-muted-foreground">
                                  {ad.headline ?? "Ad"}
                                </div>
                              )}
                              {ad.headline && <p className="p-2 text-xs line-clamp-1">{ad.headline}</p>}
                            </a>
                          ))}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null
          )}

          {/* Copy Tab */}
          {activeTab === "copy" && (
            aiLoading ? (
              <LoadingState text={t("creativeAnalysis", "analyzing")} />
            ) : aiError ? (
              <ErrorState text={aiError} />
            ) : aiResult ? (
              <AnalysisReport
                result={aiResult}
                mode="copywriter"
                onClose={() => setActiveTab("technical")}
              />
            ) : null
          )}

          {/* Visual Tab */}
          {activeTab === "visual" && (
            aiLoading ? (
              <LoadingState text={t("creativeAnalysis", "analyzing")} />
            ) : aiError ? (
              <ErrorState text={aiError} />
            ) : aiResult ? (
              <AnalysisReport
                result={aiResult}
                mode="creativeDirector"
                onClose={() => setActiveTab("technical")}
              />
            ) : null
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  loading,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-gold text-gold-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="py-16 text-center space-y-3">
      <Loader2 className="size-6 animate-spin mx-auto text-gold" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ErrorState({ text }: { text: string }) {
  return (
    <div className="py-16 text-center space-y-3">
      <AlertCircle className="size-6 mx-auto text-red-400" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ObjectiveCard({
  stats,
  t,
}: {
  stats: CompStats[];
  t: (s: string, k: string) => string;
}) {
  const OBJECTIVE_LABELS: Record<string, Record<string, string>> = {
    sales: { it: "Vendite / Conversioni", en: "Sales / Conversions" },
    traffic: { it: "Traffico", en: "Traffic" },
    awareness: { it: "Notorietà / Awareness", en: "Awareness" },
    app_install: { it: "Installazione app", en: "App Install" },
    engagement: { it: "Interazione", en: "Engagement" },
    lead_generation: { it: "Lead Generation", en: "Lead Generation" },
    unknown: { it: "Non determinabile", en: "Not determinable" },
  };

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-amber-500/30 overflow-hidden">
      <div className="bg-amber-500/10 px-4 py-2 flex items-center gap-2">
        <Target className="size-3.5 text-amber-400" />
        <p className="text-xs font-medium text-foreground">
          {t("compare", "estimatedObjective")}
        </p>
        <span className="text-[9px] text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5 uppercase tracking-wider">
          {t("compare", "estimate")}
        </span>
      </div>
      <div className={cn("grid divide-x divide-border", stats.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {stats.map((s) => {
          const obj = s.objectiveInference;
          const label = OBJECTIVE_LABELS[obj.objective]?.it ?? obj.objective;
          const isExpanded = expanded === s.id;
          return (
            <div key={s.id} className="px-4 py-3">
              <p className="text-[10px] text-muted-foreground mb-1 truncate">{s.name}</p>
              <p className="text-sm font-medium text-amber-400">{label}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${obj.confidence}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{obj.confidence}%</span>
              </div>
              <button
                onClick={() => setExpanded(isExpanded ? null : s.id)}
                className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="size-3" />
                {isExpanded ? t("compare", "hideSignals") : t("compare", "showSignals")}
              </button>
              {isExpanded && (
                <ul className="mt-2 space-y-1">
                  {obj.signals.map((signal, i) => (
                    <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">•</span>
                      {signal}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <div className="bg-amber-500/5 px-4 py-2 border-t border-amber-500/20">
        <p className="text-[9px] text-amber-400/70 leading-relaxed">
          {t("compare", "objectiveDisclaimer")}
        </p>
      </div>
    </div>
  );
}

function CompareTable({
  label,
  stats,
  render,
  highlight,
}: {
  label: string;
  stats: CompStats[];
  render: (s: CompStats) => string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", highlight && "border-gold/20")}>
      <div className="bg-muted/30 px-4 py-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
      </div>
      <div className={cn("grid divide-x divide-border", stats.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {stats.map((s) => (
          <div key={s.id} className="px-4 py-3">
            <p className="text-[10px] text-muted-foreground mb-1 truncate">{s.name}</p>
            <p className={cn("text-sm font-medium", highlight && "text-gold")}>{render(s)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
