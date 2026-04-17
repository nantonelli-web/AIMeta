/**
 * Service layer for the apify/instagram-scraper actor.
 * Uses the Apify REST API directly (no SDK), same pattern as the ads scraper.
 *
 * Actor: apify/instagram-scraper
 * Pricing: $2.30/1000 posts (pay-per-result)
 * Uses the existing APIFY_API_TOKEN.
 */

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify/instagram-scraper";

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

// ------- Normalized post shape for DB insertion -------

export interface NormalizedPost {
  post_id: string;
  post_url: string | null;
  post_type: string | null;
  caption: string | null;
  display_url: string | null;
  video_url: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  video_views: number;
  video_play_count: number;
  hashtags: string[];
  mentions: string[];
  tagged_users: string[];
  posted_at: string | null;
  raw_data: Record<string, unknown>;
}

export interface InstagramScrapeResult {
  runId: string;
  records: NormalizedPost[];
  costCu: number;
}

export interface InstagramScrapeOptions {
  username: string;
  maxPosts?: number;
}

export async function scrapeInstagramPosts(
  opts: InstagramScrapeOptions
): Promise<InstagramScrapeResult> {
  const maxPosts = opts.maxPosts ?? 30;

  const input = {
    directUrls: [`https://www.instagram.com/${opts.username}/`],
    resultsType: "posts",
    resultsLimit: maxPosts,
  };

  console.log(`[Instagram] Starting: actor=${ACTOR_ID} user=${opts.username} max=${maxPosts}`);

  const actorPath = `/acts/${encodeURIComponent(ACTOR_ID)}/runs?maxItems=${maxPosts}`;
  const run = await apifyFetch(actorPath, {
    method: "POST",
    body: JSON.stringify(input),
  });

  const runId: string = run.data?.id ?? run.id ?? "";
  const datasetId: string =
    run.data?.defaultDatasetId ?? run.defaultDatasetId ?? "";

  console.log(`[Instagram] Run created: runId=${runId} datasetId=${datasetId}`);

  if (!datasetId) {
    throw new Error("Apify run started but no datasetId returned.");
  }

  // Poll until the run finishes (max ~5 min)
  let status = run.data?.status ?? run.status ?? "RUNNING";
  const startTime = Date.now();
  const maxWait = 5 * 60 * 1000;
  let pollCount = 0;

  while (
    (status === "RUNNING" || status === "READY") &&
    Date.now() - startTime < maxWait
  ) {
    await new Promise((r) => setTimeout(r, 5000));
    pollCount++;
    const runInfo = await apifyFetch(`/actor-runs/${runId}`);
    status = runInfo.data?.status ?? runInfo.status ?? status;
    console.log(`[Instagram] Poll #${pollCount}: status=${status} elapsed=${Math.round((Date.now() - startTime) / 1000)}s`);
  }

  if (status !== "SUCCEEDED") {
    // Fetch detailed error info
    let errorDetail = "";
    try {
      const runInfo = await apifyFetch(`/actor-runs/${runId}`);
      const stats = runInfo.data?.stats ?? runInfo.stats ?? {};
      errorDetail = ` | stats: ${JSON.stringify(stats)}`;
    } catch { /* ignore */ }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.error(`[Instagram] FAILED: status=${status} after ${pollCount} polls, ${elapsed}s${errorDetail}`);
    throw new Error(`Instagram actor ${status} after ${elapsed}s (user: ${opts.username})`);
  }

  console.log(`[Instagram] Run succeeded, fetching dataset...`);

  const dataset = await apifyFetch(
    `/datasets/${datasetId}/items?format=json&limit=1000`
  );
  const items: RawInstagramPost[] = Array.isArray(dataset)
    ? dataset
    : dataset.items ?? [];

  const records = items
    .map(normalize)
    .filter((p): p is NormalizedPost => !!p.post_id);

  let costCu = 0;
  try {
    const runInfo = await apifyFetch(`/actor-runs/${runId}`);
    costCu = runInfo.data?.usageTotalUsd ?? 0;
  } catch {
    /* ignore */
  }

  return { runId, records, costCu };
}

// ------- Raw post shape from apify/instagram-scraper -------

interface RawInstagramPost {
  id?: string;
  type?: string;
  shortCode?: string;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  url?: string;
  commentsCount?: number;
  displayUrl?: string;
  images?: string[];
  videoUrl?: string;
  likesCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  videoDuration?: number;
  timestamp?: string;
  ownerFullName?: string;
  ownerUsername?: string;
  ownerId?: string;
  productType?: string;
  taggedUsers?: Array<{ username?: string; full_name?: string } | string>;
  coauthorProducers?: unknown[];
  musicInfo?: unknown;
  [k: string]: unknown;
}

function normalize(post: RawInstagramPost): NormalizedPost {
  const postId = String(post.id ?? post.shortCode ?? "");

  // Determine post type
  let postType: string | null = post.type ?? null;
  if (post.productType === "clips" && postType === "Video") {
    postType = "Reel";
  }

  // Extract tagged users as string array
  const taggedUsers: string[] = (post.taggedUsers ?? []).map((u) =>
    typeof u === "string" ? u : u.username ?? ""
  ).filter(Boolean);

  // Build post URL
  const postUrl =
    post.url ??
    (post.shortCode
      ? `https://www.instagram.com/p/${post.shortCode}/`
      : null);

  // Parse timestamp
  let postedAt: string | null = null;
  if (post.timestamp) {
    const d = new Date(post.timestamp);
    postedAt = isNaN(d.getTime()) ? null : d.toISOString();
  }

  return {
    post_id: postId,
    post_url: postUrl,
    post_type: postType,
    caption: post.caption ?? null,
    display_url: post.displayUrl ?? null,
    video_url: post.videoUrl ?? null,
    likes_count: post.likesCount ?? 0,
    comments_count: post.commentsCount ?? 0,
    shares_count: 0,
    video_views: post.videoViewCount ?? 0,
    video_play_count: post.videoPlayCount ?? 0,
    hashtags: post.hashtags ?? [],
    mentions: post.mentions ?? [],
    tagged_users: taggedUsers,
    posted_at: postedAt,
    raw_data: post as unknown as Record<string, unknown>,
  };
}
