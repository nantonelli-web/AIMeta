/**
 * Helpers for parsing Facebook page URLs / Meta Ad Library URLs.
 */

export function extractPageIdentifier(url: string): {
  username?: string;
  pageId?: string;
} {
  try {
    const u = new URL(url);
    // facebook.com/<username> or facebook.com/<username>/
    if (u.hostname.includes("facebook.com")) {
      const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
      if (/^\d+$/.test(seg)) return { pageId: seg };
      if (seg) return { username: seg };
    }
    // ad library URL: ?view_all_page_id=123
    const id = u.searchParams.get("view_all_page_id");
    if (id) return { pageId: id };
  } catch {
    // not a URL — fall through
  }
  return {};
}

export function buildAdLibraryUrl(opts: {
  pageId?: string;
  country?: string;
  active?: boolean;
  dateFrom?: string;
  dateTo?: string;
}): string {
  const params = new URLSearchParams({
    active_status: opts.active === false ? "all" : "active",
    ad_type: "all",
    country: opts.country ?? "ALL",
    media_type: "all",
  });
  if (opts.pageId) params.set("view_all_page_id", opts.pageId);
  // Build base URL then append date params with literal brackets.
  // URLSearchParams encodes [] as %5B%5D which some scrapers don't handle.
  let qs = params.toString();
  if (opts.dateFrom) qs += `&start_date[min]=${opts.dateFrom}`;
  if (opts.dateTo) qs += `&start_date[max]=${opts.dateTo}`;
  return `https://www.facebook.com/ads/library/?${qs}`;
}
