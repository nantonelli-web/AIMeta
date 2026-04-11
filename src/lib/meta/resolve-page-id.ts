/**
 * Resolve a Facebook page URL/username to a numeric page ID
 * by doing a quick 1-result scrape via the Apify actor.
 */

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = process.env.APIFY_ACTOR_ID || "apify/facebook-ads-scraper";

export async function resolvePageId(
  pageUrl: string,
  pageName?: string
): Promise<string | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;

  // Extract username from URL
  let username = "";
  try {
    const u = new URL(pageUrl);
    if (u.hostname.includes("facebook.com")) {
      const existingId = u.searchParams.get("view_all_page_id");
      if (existingId) return existingId;

      const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
      if (/^\d+$/.test(seg)) return seg;
      username = seg;
    }
  } catch {
    return null;
  }

  // Try multiple search queries: page name first (more reliable), then username
  const queries = [
    ...(pageName ? [pageName] : []),
    username,
  ].filter(Boolean);

  for (const query of queries) {
    const result = await tryResolve(query, token);
    if (result) return result;
  }

  return null;
}

async function tryResolve(
  query: string,
  token: string
): Promise<string | null> {
  try {
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&search_type=page&q=${encodeURIComponent(query)}`;

    const res = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent(ACTOR_ID)}/runs?maxItems=1&waitForFinish=90`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startUrls: [{ url: searchUrl }],
          maxItems: 1,
        }),
      }
    );

    if (!res.ok) return null;
    const run = await res.json();
    const runId = run.data?.id;
    const dsId = run.data?.defaultDatasetId;
    if (!dsId) return null;

    // Poll for completion
    let status = run.data?.status ?? "RUNNING";
    const start = Date.now();
    while (
      (status === "RUNNING" || status === "READY") &&
      Date.now() - start < 90_000
    ) {
      await new Promise((r) => setTimeout(r, 5000));
      const info = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
        headers: { authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      status = info.data?.status ?? status;
    }

    if (status !== "SUCCEEDED") return null;

    const items = await fetch(
      `${APIFY_BASE}/datasets/${dsId}/items?limit=1&format=json`,
      { headers: { authorization: `Bearer ${token}` } }
    ).then((r) => r.json());

    if (Array.isArray(items) && items.length > 0) {
      return (
        items[0].pageID?.toString() ??
        items[0].pageId?.toString() ??
        null
      );
    }

    return null;
  } catch {
    return null;
  }
}
