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
import { formatNumber } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import type { MaitAdExternal, MaitOrganicPost } from "@/types";

type Channel = "all" | "meta" | "google" | "instagram";
type Status = "all" | "active" | "inactive";

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
  /** DB-wide active-only counts per source — fed to the Status pill
   *  so the Active badge matches the brand reality, not the loaded
   *  sample. Inactive = total − active. */
  activeTotals: { meta: number; google: number };
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
  activeTotals,
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

  // Status filter — meaningful only on paid channels (Meta + Google).
  // Instagram has no ACTIVE/INACTIVE concept on organic posts, so it
  // is reset alongside country when the user switches to Instagram.
  const [status, setStatus] = useState<Status>("all");
  useEffect(() => {
    if (channel === "instagram") setStatus("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  // Status helper — Meta + Google share the same ACTIVE / INACTIVE
  // shape on mait_ads_external.status. Anything not "ACTIVE" is treated
  // as inactive (covers ENDED + null + future variants).
  const matchesStatus = (a: MaitAdExternal) => {
    if (status === "all") return true;
    const s = (a as unknown as Record<string, unknown>).status;
    if (status === "active") return s === "ACTIVE";
    return s !== "ACTIVE";
  };

  // Split ads by source — then filter by status. Meta also gets the
  // country filter applied below.
  const metaAdsAll = ads.filter((a) => {
    const src = (a as unknown as Record<string, unknown>).source;
    return src !== "google" && matchesStatus(a);
  });
  const googleAds = ads.filter((a) => {
    const src = (a as unknown as Record<string, unknown>).source;
    return src === "google" && matchesStatus(a);
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

  // Channel badge counts honour the active Status filter: when the
  // user picks "Active", each channel chip shows its DB-wide active
  // subset (so 396 Meta → 84 if only 84 are currently active). The
  // "all" tab sums the paid subset under filter + the unfiltered
  // Instagram total since organic has no ACTIVE/INACTIVE concept.
  const metaCount =
    status === "all"
      ? channelTotals.meta
      : status === "active"
        ? activeTotals.meta
        : Math.max(0, channelTotals.meta - activeTotals.meta);
  const googleCount =
    status === "all"
      ? channelTotals.google
      : status === "active"
        ? activeTotals.google
        : Math.max(0, channelTotals.google - activeTotals.google);
  const instagramCount = channelTotals.instagram;

  const tabs: { key: Channel; label: string; count: number; icon?: React.ReactNode }[] = [
    {
      key: "all",
      label: t("competitors", "channelAll"),
      count: metaCount + googleCount + instagramCount,
    },
    { key: "meta", label: "Meta Ads", count: metaCount, icon: <MetaIcon className="size-3.5" /> },
    { key: "google", label: "Google Ads", count: googleCount, icon: <GoogleIcon className="size-3.5" /> },
    { key: "instagram", label: "Instagram", count: instagramCount, icon: <InstagramIcon className="size-3.5" /> },
  ];

  // Status pills — paid channels only (Instagram organic posts have
  // no ACTIVE/INACTIVE concept). Counts come from the head+exact
  // queries done in the parent page; we drop them from the pill UI
  // itself to mirror Benchmarks but keep the structure here in case
  // we want them back as e.g. tooltips or sidebar copy.
  const showStatusFilter = channel !== "instagram";
  const statusPills: { key: Status; label: string }[] = [
    { key: "all", label: t("competitors", "channelAll") },
    { key: "active", label: t("competitors", "statusActive") },
    { key: "inactive", label: t("competitors", "statusInactive") },
  ];

  // Filter out channels with 0 items (except "all")
  const visibleTabs = tabs.filter((tab) => tab.key === "all" || tab.count > 0);

  const showMeta = channel === "all" || channel === "meta";
  const showGoogle = channel === "all" || channel === "google";
  const showInstagram = channel === "all" || channel === "instagram";

  const visibleAds = channel === "meta" ? metaAds : channel === "google" ? googleAds : channel === "all" ? ads : [];
  const visibleOrganic = showInstagram ? organicPosts : [];

  // Identical chip class to Benchmarks: flat pill, gold/15 selected,
  // neutral border otherwise. No count badge — counts are already
  // visible in the "(X of Y) ads" line above each grid, and Benchmarks
  // itself omits them for visual cleanliness.
  const chipClass = (selected: boolean) =>
    selected
      ? "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gold/15 text-gold border border-gold/30 transition-colors cursor-pointer"
      : "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer";

  return (
    <div className="space-y-6">
      {/* ─── Channel + Status row ─────────────────────────────
          Same grammar as the Benchmarks filter strip: inline label
          (uppercase 10px bold), pills without count badges, vertical
          divider between groups. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-foreground font-bold">
            {t("competitors", "filterByChannel")}
          </span>
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setChannel(tab.key)}
              className={chipClass(channel === tab.key)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {showStatusFilter && (
          <>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-foreground font-bold">
                {t("competitors", "filterByStatus")}
              </span>
              {statusPills.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setStatus(p.key)}
                  className={chipClass(status === p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── Country row (Meta only) ─────────────────────────
          Own row because country chips can be many. Same flat
          pattern as the row above. */}
      {showCountryFilter && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 print:hidden">
          <span className="text-[10px] uppercase tracking-wider text-foreground font-bold mr-1">
            {t("competitors", "filterByCountry")}
          </span>
          <button
            type="button"
            onClick={() => setCountry(null)}
            className={chipClass(country === null)}
          >
            {t("competitors", "channelAll")}
          </button>
          {availableCountries.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setCountry(c.code)}
              className={chipClass(country === c.code)}
            >
              <span className="font-mono">{c.code}</span>
            </button>
          ))}
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
                    {metaCount > metaAds.length
                      ? ` ${t("competitors", "ofTotal")} ${metaCount}`
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
                  {googleCount > googleAds.length
                    ? ` ${t("competitors", "ofTotal")} ${googleCount}`
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
                      channel === "meta" ? metaCount : googleCount;
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
