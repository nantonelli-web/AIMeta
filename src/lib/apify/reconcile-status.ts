import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mark previously-ACTIVE Meta ads INACTIVE when they did not surface
 * in the latest per-country scan for a competitor.
 *
 * Apify is always asked for `active: true`, so any ad we got back is
 * still running. The flip side — ads that used to be returned and now
 * are not — means Meta has stopped them. Without this reconcile our
 * `status` column drifts from reality between scans, inflating the
 * volume chart and the "active ads" header on Benchmarks.
 *
 * Safety properties:
 *
 * 1. `scannedCountries` is required and non-empty. The legacy
 *    country=ALL flow has scan_countries=null on every row and we
 *    cannot reason about which markets were just covered, so the
 *    reconcile is skipped for those scans.
 * 2. Only ads whose `scan_countries` is a SUBSET of `scannedCountries`
 *    are considered. An ad scanned previously in GB will not be
 *    flipped INACTIVE during a scan that only covered IT/FR — we have
 *    no negative evidence about GB.
 * 3. When the new scan returned zero records the function is a no-op.
 *    A genuine empty scan is rare; an Apify hiccup that returns
 *    success with no items is more common, and mass-inactivating
 *    every ad in scope on the latter would be a disaster. Stale data
 *    is preferable to mass false negatives.
 *
 * Returns the number of rows that were flipped, for logging.
 */
export async function reconcileMetaAdStatus(
  admin: SupabaseClient,
  competitorId: string,
  newArchiveIds: string[],
  scannedCountries: string[],
): Promise<number> {
  if (newArchiveIds.length === 0) return 0;
  if (scannedCountries.length === 0) return 0;

  const newSet = new Set(newArchiveIds);

  // Pull every ACTIVE ad that lives entirely inside the just-scanned
  // country set. PostgREST's containedBy maps to the array <@ operator.
  const { data: existing, error } = await admin
    .from("mait_ads_external")
    .select("id, ad_archive_id")
    .eq("competitor_id", competitorId)
    .eq("source", "meta")
    .eq("status", "ACTIVE")
    .containedBy("scan_countries", scannedCountries);

  if (error) {
    console.error("[reconcile-status select]", error);
    return 0;
  }

  const idsToInactivate: string[] = [];
  for (const r of existing ?? []) {
    const archive = (r as { ad_archive_id: string | null }).ad_archive_id;
    const id = (r as { id: string }).id;
    if (!archive) continue;
    if (newSet.has(archive)) continue;
    idsToInactivate.push(id);
  }

  if (idsToInactivate.length === 0) return 0;

  // Chunk to keep the IN list inside PostgREST's URL budget.
  const CHUNK = 500;
  for (let i = 0; i < idsToInactivate.length; i += CHUNK) {
    const slice = idsToInactivate.slice(i, i + CHUNK);
    const { error: updErr } = await admin
      .from("mait_ads_external")
      .update({ status: "INACTIVE" })
      .in("id", slice);
    if (updErr) {
      console.error("[reconcile-status update]", updErr);
      return 0;
    }
  }

  return idsToInactivate.length;
}
