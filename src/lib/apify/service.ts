import { buildAdLibraryUrl } from "@/lib/meta/url";

/**
 * Service layer for the apify/facebook-ads-scraper actor (official).
 * Uses the Apify REST API directly (no SDK).
 *
 * This actor provides full ad data INCLUDING direct image/video URLs
 * inside the `snapshot.cards[]` array:
 *   - originalImageUrl / resizedImageUrl (direct fbcdn URLs)
 *   - videoHdUrl / videoSdUrl / videoPreviewImageUrl
 *   - title, body, linkUrl, ctaText, caption
 *
 * Pricing: $5.80/1000 ads (Free), $5.00 (Starter), $3.40 (Business)
 * Platform usage: Free
 */

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = process.env.APIFY_ACTOR_ID || "apify/facebook-ads-scraper";

function getToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN missing.");
  return token;
}

async function apifyFetch(path: string, init?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${APIFY_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export interface NormalizedAd {
  ad_archive_id: string;
  ad_text: string | null;
  headline: string | null;
  description: string | null;
  cta: string | null;
  image_url: string | null;
  video_url: string | null;
  landing_url: string | null;
  platforms: string[];
  languages: string[];
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  raw_data: Record<string, unknown>;
}

export interface ScrapeResult {
  runId: string;
  records: NormalizedAd[];
  costCu: number;
  startUrl: string;
}

export interface ScrapeOptions {
  pageId?: string;
  pageName?: string;
  pageUrl?: string;
  country?: string;
  maxItems?: number;
  active?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export async function scrapeMetaAds(
  opts: ScrapeOptions
): Promise<ScrapeResult> {
  const startUrl =
    opts.pageUrl?.includes("ads/library")
      ? opts.pageUrl
      : buildAdLibraryUrl({
          pageId: opts.pageId,
          searchQuery: opts.pageId ? undefined : opts.pageName,
          // Use ALL when multiple countries are configured so we don't
          // miss ads targeting other regions (e.g. DE for a German brand).
          country: opts.country?.includes(",") ? "ALL" : opts.country,
          active: opts.active,
          dateFrom: opts.dateFrom,
          dateTo: opts.dateTo,
        });

  const maxItems = opts.maxItems ?? 200;
  const input: Record<string, unknown> = {
    startUrls: [{ url: startUrl }],
    maxItems,
  };
  // Pass dates as direct actor input fields (some actors read these
  // instead of / in addition to the URL query params).
  if (opts.dateFrom) input.startDate = opts.dateFrom;
  if (opts.dateTo) input.endDate = opts.dateTo;

  // maxItems is passed both in input AND as query param (pay-per-result billing)
  const actorPath = `/acts/${encodeURIComponent(ACTOR_ID)}/runs?maxItems=${maxItems}`;
  const run = await apifyFetch(actorPath, {
    method: "POST",
    body: JSON.stringify(input),
  });

  const runId: string = run.data?.id ?? run.id ?? "";
  const datasetId: string =
    run.data?.defaultDatasetId ?? run.defaultDatasetId ?? "";

  if (!datasetId) {
    throw new Error("Apify run started but no datasetId returned.");
  }

  // Poll until the run finishes (max ~5 min)
  let status = run.data?.status ?? run.status ?? "RUNNING";
  const startTime = Date.now();
  const maxWait = 5 * 60 * 1000;

  while (
    (status === "RUNNING" || status === "READY") &&
    Date.now() - startTime < maxWait
  ) {
    await new Promise((r) => setTimeout(r, 5000));
    const runInfo = await apifyFetch(`/actor-runs/${runId}`);
    status = runInfo.data?.status ?? runInfo.status ?? status;
  }

  if (status !== "SUCCEEDED") {
    throw new Error(`Apify run ended with status: ${status}`);
  }

  const dataset = await apifyFetch(
    `/datasets/${datasetId}/items?format=json&limit=1000`
  );
  const items: RawAd[] = Array.isArray(dataset) ? dataset : dataset.items ?? [];

  const records = items
    .map(normalize)
    .filter((a): a is NormalizedAd => !!a.ad_archive_id);

  let costCu = 0;
  try {
    const runInfo = await apifyFetch(`/actor-runs/${runId}`);
    costCu = runInfo.data?.usageTotalUsd ?? 0;
  } catch {
    /* ignore */
  }

  return { runId, records, costCu, startUrl };
}

// ------- Raw ad shape from apify/facebook-ads-scraper -------

interface SnapshotCard {
  body?: string;
  title?: string;
  caption?: string;
  ctaText?: string;
  ctaType?: string;
  linkUrl?: string;
  linkDescription?: string;
  originalImageUrl?: string;
  resizedImageUrl?: string;
  videoHdUrl?: string;
  videoSdUrl?: string;
  videoPreviewImageUrl?: string;
  watermarkedVideoHdUrl?: string;
  watermarkedVideoSdUrl?: string;
}

interface SnapshotImage {
  originalImageUrl?: string;
  resizedImageUrl?: string;
  imageCrops?: unknown[];
}

interface SnapshotVideo {
  videoHdUrl?: string;
  videoSdUrl?: string;
  videoPreviewImageUrl?: string;
}

interface Snapshot {
  pageName?: string;
  pageId?: string;
  pageProfileUri?: string;
  pageProfilePictureUrl?: string;
  caption?: string;
  ctaText?: string;
  ctaType?: string;
  linkUrl?: string;
  body?: string;
  title?: string;
  displayFormat?: string;
  pageLikeCount?: number;
  pageCategories?: string[];
  isReshared?: boolean;
  cards?: SnapshotCard[];
  images?: SnapshotImage[];
  videos?: SnapshotVideo[];
  extraImages?: SnapshotImage[];
  extraVideos?: SnapshotVideo[];
  event?: unknown;
}

interface RelatedPage {
  pageId?: string;
  pageName?: string;
  country?: string;
}

interface PageInfo {
  adLibraryPageInfo?: {
    relatedPages?: RelatedPage[];
  };
}

interface RawAd {
  adArchiveID?: string;
  adArchiveId?: string;
  pageID?: string;
  pageId?: string;
  pageName?: string;
  isActive?: boolean;
  startDate?: number;
  endDate?: number | null;
  startDateFormatted?: string;
  endDateFormatted?: string;
  publisherPlatform?: string[];
  snapshot?: Snapshot;
  categories?: string[];
  containsDigitalCreatedMedia?: boolean;
  isAaaEligible?: boolean;
  collationCount?: number;
  targetedOrReachedCountries?: string[];
  pageInfo?: PageInfo;
  // Fallback fields from other actors
  adText?: string;
  adStatus?: string;
  [k: string]: unknown;
}

function toIso(v: string | number | undefined | null): string | null {
  if (v == null) return null;
  if (typeof v === "number") {
    // Unix timestamp in seconds
    const ms = v < 1e12 ? v * 1000 : v;
    return new Date(ms).toISOString();
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function normalize(ad: RawAd): NormalizedAd {
  const snap = ad.snapshot;
  const card = snap?.cards?.[0];
  const firstImage = snap?.images?.[0];
  const firstVideo = snap?.videos?.[0];

  // Extract image: cards > snapshot.images > snapshot.extraImages
  const imageUrl =
    card?.originalImageUrl ??
    card?.resizedImageUrl ??
    card?.videoPreviewImageUrl ??
    firstImage?.originalImageUrl ??
    firstImage?.resizedImageUrl ??
    snap?.extraImages?.[0]?.originalImageUrl ??
    snap?.extraImages?.[0]?.resizedImageUrl ??
    null;

  // Extract video: cards > snapshot.videos
  // displayFormat is stored in raw_data and read by the UI for badge display
  const videoUrl =
    card?.videoHdUrl ??
    card?.videoSdUrl ??
    firstVideo?.videoHdUrl ??
    firstVideo?.videoSdUrl ??
    null;

  // Extract text: cards > snapshot body > top-level
  const adText = card?.body ?? snap?.body ?? ad.adText ?? null;
  const headline = card?.title ?? snap?.title ?? null;
  const description = card?.linkDescription ?? null;
  const cta = card?.ctaText ?? snap?.ctaText ?? null;
  const landingUrl = card?.linkUrl ?? snap?.linkUrl ?? null;

  // Platforms from the official actor use uppercase
  const platforms = (ad.publisherPlatform ?? []).map((p) =>
    p.toLowerCase()
  );

  return {
    ad_archive_id: String(
      ad.adArchiveID ?? ad.adArchiveId ?? ""
    ),
    ad_text: adText,
    headline,
    description,
    cta,
    image_url: imageUrl,
    video_url: videoUrl,
    landing_url: landingUrl,
    platforms,
    languages: [],
    start_date:
      toIso(ad.startDateFormatted ?? ad.startDate),
    end_date:
      toIso(ad.endDateFormatted ?? ad.endDate),
    status: ad.isActive ? "ACTIVE" : ad.adStatus ?? "INACTIVE",
    raw_data: ad as unknown as Record<string, unknown>,
  };
}
