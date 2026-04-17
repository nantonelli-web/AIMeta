/**
 * Service layer for the Google Ads Transparency scraper on Apify.
 * Actor: khadinakbar/google-ads-transparency-scraper
 *
 * Uses the same Apify REST API as the Meta scraper.
 * Returns data from the Google Ads Transparency Center.
 *
 * Pricing: ~$3.00/1,000 ads (pay-per-event)
 */

import type { NormalizedAd, ScrapeResult } from "./service";

const APIFY_BASE = "https://api.apify.com/v2";
const GOOGLE_ACTOR_ID =
  process.env.APIFY_GOOGLE_ACTOR_ID ||
  "khadinakbar/google-ads-transparency-scraper";

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

// ─── Raw shape from khadinakbar/google-ads-transparency-scraper ───

interface RawGoogleAd {
  advertiser_name?: string;
  advertiser_id?: string;
  advertiser_domain?: string;
  ad_id?: string;
  ad_headline?: string;
  ad_text?: string;
  ad_format?: string; // TEXT | IMAGE | VIDEO | SHOPPING
  ad_image_url?: string | null;
  ad_video_url?: string | null;
  destination_url?: string | null;
  regions_shown?: string[];
  platforms?: string[]; // GOOGLE_SEARCH | YOUTUBE | DISPLAY | MAPS
  first_shown_date?: string | null;
  last_shown_date?: string | null;
  is_political_ad?: boolean;
  scraped_at?: string;
  source_url?: string;
  [k: string]: unknown;
}

// ─── Options ───

export interface GoogleScrapeOptions {
  advertiserDomain?: string;
  advertiserName?: string;
  advertiserId?: string;
  /** Primary country code for the Apify search (first selected country). */
  countryCode?: string;
  /** Filter results by date range (applied client-side after fetch). */
  dateFrom?: string;
  dateTo?: string;
  maxResults?: number;
}

// ─── Normalize ───

function normalize(ad: RawGoogleAd): NormalizedAd {
  const adId = ad.ad_id ?? "";

  // Status: if last_shown_date is null → still active
  const status = ad.last_shown_date == null ? "ACTIVE" : "INACTIVE";

  const platforms = (ad.platforms ?? []).map((p) => p.toLowerCase());

  return {
    ad_archive_id: adId,
    ad_text: ad.ad_text ?? null,
    headline: ad.ad_headline ?? null,
    description: null, // Google Transparency doesn't provide a separate description field
    cta: null, // No CTA field in Google Transparency data
    image_url: ad.ad_image_url ?? null,
    video_url: ad.ad_video_url ?? null,
    landing_url: ad.destination_url ?? null,
    platforms,
    languages: [],
    start_date: ad.first_shown_date
      ? new Date(ad.first_shown_date).toISOString()
      : null,
    end_date: ad.last_shown_date
      ? new Date(ad.last_shown_date).toISOString()
      : null,
    status,
    raw_data: ad as unknown as Record<string, unknown>,
  };
}

// ─── Single-country run (internal) ───

async function runForCountry(
  searchInput: Record<string, unknown>,
  countryCode: string | undefined,
  maxResults: number
): Promise<{ runId: string; records: NormalizedAd[]; costCu: number }> {
  const input: Record<string, unknown> = { ...searchInput, maxResults };
  if (countryCode) input.countryCode = countryCode;

  const actorPath = `/acts/${encodeURIComponent(GOOGLE_ACTOR_ID)}/runs`;
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
  const items: RawGoogleAd[] = Array.isArray(dataset)
    ? dataset
    : dataset.items ?? [];

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

  return { runId, records, costCu };
}

// ─── Main scrape function ───

export async function scrapeGoogleAds(
  opts: GoogleScrapeOptions
): Promise<ScrapeResult> {
  const maxResults = opts.maxResults ?? 200;

  // Build search input — single Apify run (no per-country splitting)
  const searchInput: Record<string, unknown> = {};

  if (opts.advertiserId) {
    searchInput.searchQuery = opts.advertiserId;
    searchInput.searchType = "advertiserId";
  } else if (opts.advertiserDomain) {
    searchInput.searchQuery = opts.advertiserDomain;
    searchInput.searchType = "domain";
  } else if (opts.advertiserName) {
    searchInput.searchQuery = opts.advertiserName;
    searchInput.searchType = "advertiserName";
  } else {
    throw new Error(
      "Google Ads scrape requires advertiserId, advertiserDomain, or advertiserName"
    );
  }

  // Single run with primary country (or no country filter)
  const run = await runForCountry(searchInput, opts.countryCode, maxResults);

  let records = run.records;

  // Client-side date filter (Google Transparency actor doesn't support date range)
  if (opts.dateFrom || opts.dateTo) {
    const from = opts.dateFrom ? new Date(opts.dateFrom).getTime() : 0;
    const to = opts.dateTo ? new Date(opts.dateTo).getTime() + 86_400_000 : Infinity;
    records = records.filter((r) => {
      const start = r.start_date ? new Date(r.start_date).getTime() : 0;
      return start >= from && start <= to;
    });
  }

  const startUrl = `https://adstransparency.google.com/?domain=${opts.advertiserDomain ?? opts.advertiserName ?? opts.advertiserId}`;
  return { runId: run.runId, records, costCu: run.costCu, startUrl };
}
