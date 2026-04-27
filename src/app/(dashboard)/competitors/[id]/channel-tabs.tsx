"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { AdCard } from "@/components/ads/ad-card";
import { OrganicPostCard } from "@/components/organic/organic-post-card";
import { TagButton } from "@/components/ads/tag-button";
import { InstagramIcon } from "@/components/ui/instagram-icon";
import { MetaIcon } from "@/components/ui/meta-icon";
import { Download } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import type { MaitAdExternal, MaitOrganicPost } from "@/types";

type Channel = "all" | "meta" | "google" | "instagram";

/* ─── Platform icons (small, inline) ─── */

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
      <path d="M5.84 14.09A6.68 6.68 0 0 1 5.5 12c0-.72.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
    </svg>
  );
}

/* ─── Component ─── */

interface Props {
  competitorId: string;
  ads: MaitAdExternal[];
  organicPosts: MaitOrganicPost[];
  /** DB-wide totals per channel — drive the filter chip badges so the
   *  user sees the real count for the brand, not the lazy-loaded
   *  array length (which is capped at 30 for performance). */
  channelTotals: { meta: number; google: number; instagram: number };
  organicStats: {
    count: number;
    /** null when every post has likes hidden (Instagram setting) —
     *  rendered as em-dash instead of "0" or "-1" so the user sees
     *  "unknown" rather than wrong numbers. */
    avgLikes: number | null;
    avgComments: number | null;
    totalViews: number;
  };
}

function isChannel(v: string | null): v is Channel {
  return v === "all" || v === "meta" || v === "google" || v === "instagram";
}

export function ChannelTabs({
  competitorId,
  ads,
  organicPosts,
  channelTotals,
  organicStats,
}: Props) {
  const searchParams = useSearchParams();
  const initialFromUrl = searchParams.get("tab");
  const [channel, setChannel] = useState<Channel>(
    isChannel(initialFromUrl) ? initialFromUrl : "all",
  );
  // When the user runs a scan and scan-dropdown rewrites the URL with
  // ?tab=instagram, the searchParams update fires this effect and we
  // sync the local state. Without this the user would still see
  // whichever tab they had open before the scan.
  useEffect(() => {
    const t = searchParams.get("tab");
    if (isChannel(t) && t !== channel) setChannel(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  // Country filter only applies to Meta — Google + Instagram do not
  // carry scan_countries — so we drop any selected country when the
  // channel switches away from Meta to avoid an invisible filter.
  useEffect(() => {
    if (channel === "google" || channel === "instagram") setCountry(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);
  const { t } = useT();

  // Country filter — only applies to Meta ads (Google ads have
  // scan_countries=null because Google Ads is not scraped per-country).
  // null means "all countries", a string is the selected ISO code.
  const [country, setCountry] = useState<string | null>(null);

  // Split ads by source
  const metaAdsAll = ads.filter((a) => {
    const src = (a as unknown as Record<string, unknown>).source;
    return src !== "google";
  });
  const googleAds = ads.filter((a) => {
    const src = (a as unknown as Record<string, unknown>).source;
    return src === "google";
  });

  // Available country chips = union of scan_countries across the
  // loaded Meta sample. We use the loaded sample (not a DB-wide
  // query) because the filter operates on what is rendered on the
  // page; a country with no ad in the visible window cannot be
  // filtered to any visible card anyway.
  const countryTallyMap = new Map<string, number>();
  for (const ad of metaAdsAll) {
    const list = (ad as unknown as { scan_countries?: string[] | null })
      .scan_countries;
    if (!Array.isArray(list)) continue;
    for (const c of list) {
      if (typeof c === "string" && c) {
        countryTallyMap.set(c, (countryTallyMap.get(c) ?? 0) + 1);
      }
    }
  }
  const availableCountries = [...countryTallyMap.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
  const showCountryFilter =
    availableCountries.length > 0 &&
    (channel === "all" || channel === "meta");

  // Apply the country filter to the Meta ads only — Google + Instagram
  // have no per-country signal, so they pass through unchanged.
  const metaAds =
    country === null
      ? metaAdsAll
      : metaAdsAll.filter((a) => {
          const list = (a as unknown as { scan_countries?: string[] | null })
            .scan_countries;
          return Array.isArray(list) && list.includes(country);
        });

  // Badge counts come from the DB-wide totals fetched in the parent
  // page, NOT from the lazy-loaded array length (capped at 30). The
  // grid below still renders only the loaded sample — the badge is
  // there to tell the user how many ads exist in total for the brand.
  const tabs: { key: Channel; label: string; count: number; icon?: React.ReactNode }[] = [
    {
      key: "all",
      label: t("competitors", "channelAll"),
      count:
        channelTotals.meta + channelTotals.google + channelTotals.instagram,
    },
    { key: "meta", label: "Meta Ads", count: channelTotals.meta, icon: <MetaIcon className="size-3.5" /> },
    { key: "google", label: "Google Ads", count: channelTotals.google, icon: <GoogleIcon className="size-3.5" /> },
    { key: "instagram", label: "Instagram", count: channelTotals.instagram, icon: <InstagramIcon className="size-3.5" /> },
  ];

  // Filter out channels with 0 items (except "all")
  const visibleTabs = tabs.filter((tab) => tab.key === "all" || tab.count > 0);

  const showMeta = channel === "all" || channel === "meta";
  const showGoogle = channel === "all" || channel === "google";
  const showInstagram = channel === "all" || channel === "instagram";

  const visibleAds = channel === "meta" ? metaAds : channel === "google" ? googleAds : channel === "all" ? ads : [];
  const visibleOrganic = showInstagram ? organicPosts : [];

  return (
    <div className="space-y-6">
      {/* ─── Channel filter ─── */}
      {/* Lifted to a framed strip with bigger pills + stronger
          contrast so users actually notice it. Previously rendered
          as a tiny inline-flex row that disappeared between the
          page hero and the ad grid. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3 print:hidden">
        <span className="text-[11px] uppercase tracking-wider text-foreground font-bold shrink-0">
          {t("competitors", "filterBy")}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setChannel(tab.key)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
                channel === tab.key
                  ? "bg-gold/15 text-gold border border-gold/40"
                  : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
              <span className={cn(
                "text-[10px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center",
                channel === tab.key
                  ? "bg-gold/25 text-gold"
                  : "bg-muted text-muted-foreground"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Country filter (Meta only) ─────────────────────
          Visible when the loaded Meta sample contains at least one
          ad with scan_countries populated. Counts come from the
          loaded sample (capped at 30) — same convention as the
          "30 of N" labels in the grid headers below. Hidden for
          Google + Instagram because those channels do not carry a
          per-country signal. */}
      {showCountryFilter && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3 print:hidden">
          <span className="text-[11px] uppercase tracking-wider text-foreground font-bold shrink-0">
            {t("competitors", "filterByCountry")}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCountry(null)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
                country === null
                  ? "bg-gold/15 text-gold border border-gold/40"
                  : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span className="font-medium">{t("competitors", "channelAll")}</span>
            </button>
            {availableCountries.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCountry(c.code)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
                  country === c.code
                    ? "bg-gold/15 text-gold border border-gold/40"
                    : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span className="font-medium font-mono">{c.code}</span>
                <span className={cn(
                  "text-[10px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center",
                  country === c.code
                    ? "bg-gold/25 text-gold"
                    : "bg-muted text-muted-foreground"
                )}>
                  {c.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Ads section ─── */}
      {channel === "all" ? (
        <>
          {/* All: grouped by channel. The (X of Y) suffix tells the
              user that the grid is a recent slice — Y is the real DB
              total, X is the loaded sample (capped at 30). */}
          {metaAds.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MetaIcon className="size-4 text-gold" />
                  <p className="text-sm font-medium">Meta Ads</p>
                  <span className="text-xs text-muted-foreground">
                    ({metaAds.length}
                    {channelTotals.meta > metaAds.length
                      ? ` ${t("competitors", "ofTotal")} ${channelTotals.meta}`
                      : ""}
                    )
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <TagButton competitorId={competitorId} />
                  <a
                    href={`/api/export/ads.csv?competitor_id=${competitorId}`}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download className="size-3" />
                    {t("competitors", "exportCsv")}
                  </a>
                </div>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {metaAds.map((ad) => (
                  <AdCard key={ad.id} ad={ad} competitorId={competitorId} />
                ))}
              </div>
            </div>
          )}

          {googleAds.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <GoogleIcon className="size-4 text-gold" />
                <p className="text-sm font-medium">Google Ads</p>
                <span className="text-xs text-muted-foreground">
                  ({googleAds.length}
                  {channelTotals.google > googleAds.length
                    ? ` ${t("competitors", "ofTotal")} ${channelTotals.google}`
                    : ""}
                  )
                </span>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {googleAds.map((ad) => (
                  <AdCard key={ad.id} ad={ad} competitorId={competitorId} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Filtered: single channel */}
          {(channel === "meta" || channel === "google") && visibleAds.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {visibleAds.length}
                  {(() => {
                    const total =
                      channel === "meta"
                        ? channelTotals.meta
                        : channelTotals.google;
                    return total > visibleAds.length
                      ? ` ${t("competitors", "ofTotal")} ${total}`
                      : "";
                  })()}
                  {" "}ads
                </p>
                <div className="flex items-center gap-3">
                  <TagButton competitorId={competitorId} />
                  <a
                    href={`/api/export/ads.csv?competitor_id=${competitorId}`}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download className="size-3" />
                    {t("competitors", "exportCsv")}
                  </a>
                </div>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleAds.map((ad) => (
                  <AdCard key={ad.id} ad={ad} competitorId={competitorId} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state for single channel */}
          {(channel === "meta" || channel === "google") && visibleAds.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                {channel === "meta" ? t("competitors", "noMetaAds") : t("competitors", "noGoogleAds")}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ─── Instagram section ─── */}
      {showInstagram && (
        <div className="space-y-4">
          {/* Engagement stats */}
          {organicStats.count > 0 && channel === "instagram" && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-semibold">
                    {channelTotals.instagram}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("organic", "totalPosts")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-semibold">
                    {organicStats.avgLikes != null ? formatNumber(organicStats.avgLikes) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("organic", "avgLikes")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-semibold">
                    {organicStats.avgComments != null ? formatNumber(organicStats.avgComments) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("organic", "avgComments")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-semibold">{formatNumber(organicStats.totalViews)}</p>
                  <p className="text-xs text-muted-foreground">{t("organic", "totalViews")}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {visibleOrganic.length === 0 ? (
            channel === "instagram" && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  {t("organic", "noPostsYet")}
                </CardContent>
              </Card>
            )
          ) : (
            <>
              {channel === "instagram" && (
                <p className="text-sm text-muted-foreground">
                  {visibleOrganic.length}
                  {channelTotals.instagram > visibleOrganic.length
                    ? ` ${t("competitors", "ofTotal")} ${channelTotals.instagram}`
                    : ""}
                  {" "}{t("organic", "postsCount")}
                </p>
              )}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleOrganic.map((post) => (
                  <OrganicPostCard key={post.id} post={post} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state for "all" when nothing exists */}
      {channel === "all" && ads.length === 0 && organicPosts.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {t("competitors", "noAdsCollected")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
