import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { competitorsTag } from "@/lib/library/cached-data";
import { cleanInstagramUsername } from "@/lib/instagram/service";
import { cleanAdvertiserDomain } from "@/lib/apify/google-ads-service";
import { coerceCountryForStorage } from "@/lib/meta/country-codes";

const patchSchema = z.object({
  // Monitor config fields
  frequency: z.enum(["manual", "daily", "weekly"]).optional(),
  max_items: z.number().int().min(10).max(1000).optional(),
  // Editable competitor fields
  page_name: z.string().min(1).max(160).optional(),
  page_url: z.string().url().optional(),
  country: z.string().max(200).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  instagram_username: z.string().max(60).nullable().optional(),
  google_advertiser_id: z.string().max(80).nullable().optional(),
  google_domain: z.string().max(200).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const {
    frequency, max_items, page_name, page_url, country, category,
    client_id, instagram_username, google_advertiser_id, google_domain,
  } = parsed.data;

  // Separate monitor_config fields from direct fields
  const directUpdate: Record<string, unknown> = {};
  if (page_name !== undefined) directUpdate.page_name = page_name;
  if (page_url !== undefined) directUpdate.page_url = page_url;
  if (country !== undefined) directUpdate.country = coerceCountryForStorage(country);
  if (category !== undefined) directUpdate.category = category;
  if (client_id !== undefined) directUpdate.client_id = client_id;
  if (instagram_username !== undefined) {
    // Accept @handle, handle, or full profile URL; store only the clean handle.
    directUpdate.instagram_username = instagram_username
      ? cleanInstagramUsername(instagram_username)
      : null;
  }
  if (google_advertiser_id !== undefined) directUpdate.google_advertiser_id = google_advertiser_id;
  if (google_domain !== undefined) {
    // Accept full URL or bare domain, store only the bare domain so the
    // Google Ads scraper can query it directly.
    directUpdate.google_domain = google_domain
      ? cleanAdvertiserDomain(google_domain)
      : null;
  }

  // Handle monitor_config merge if frequency or max_items changed
  if (frequency !== undefined || max_items !== undefined) {
    const { data: current } = await supabase
      .from("mait_competitors")
      .select("monitor_config")
      .eq("id", id)
      .single();

    directUpdate.monitor_config = {
      ...(current?.monitor_config ?? {}),
      ...(frequency !== undefined ? { frequency } : {}),
      ...(max_items !== undefined ? { max_items } : {}),
    };
  }

  if (Object.keys(directUpdate).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { data: updated, error } = await supabase
    .from("mait_competitors")
    .update(directUpdate)
    .eq("id", id)
    .select("workspace_id")
    .single();

  if (error) {
    console.error("[api/competitors/:id]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
  if (updated?.workspace_id) revalidateTag(competitorsTag(updated.workspace_id));
  return NextResponse.json({ ok: true });
}

/**
 * Delete a competitor and everything associated with it.
 *
 * Foreign keys on the related tables are inconsistent — some cascade
 * (`mait_organic_posts`, `mait_collection_ads` via ads), others set
 * NULL (`mait_ads_external`, `mait_scrape_jobs`, `mait_alerts`). If we
 * relied on the FKs alone, deleting a brand would leave orphan ads and
 * jobs sitting in tables forever. So we do the cleanup explicitly with
 * the admin client (RLS would block the orphan rows once the parent is
 * gone). Order matters: ads → jobs → alerts → competitor, so each step
 * can hit FK-set-null cleanly.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS-checked read so non-members of the workspace cannot delete.
  const { data: existing, error: existingErr } = await supabase
    .from("mait_competitors")
    .select("workspace_id")
    .eq("id", id)
    .single();
  if (existingErr || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();

  // Wipe the related rows first. `mait_ads_external` is the heaviest
  // and will also cascade to mait_collection_ads + mait_ads_tags via
  // its own FKs. Jobs and alerts are small but would otherwise survive
  // with competitor_id = NULL because their FK is `on delete set null`.
  const adsDel = await admin
    .from("mait_ads_external")
    .delete()
    .eq("competitor_id", id);
  if (adsDel.error) {
    console.error("[api/competitors/:id ads cleanup]", adsDel.error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const jobsDel = await admin
    .from("mait_scrape_jobs")
    .delete()
    .eq("competitor_id", id);
  if (jobsDel.error) {
    console.error("[api/competitors/:id jobs cleanup]", jobsDel.error);
  }

  const alertsDel = await admin
    .from("mait_alerts")
    .delete()
    .eq("competitor_id", id);
  if (alertsDel.error) {
    console.error("[api/competitors/:id alerts cleanup]", alertsDel.error);
  }

  // Saved comparisons reference competitors via an array column, so
  // they have no FK at all. Mark any that include this brand as stale
  // so the user knows the cached technical_data no longer matches the
  // current set of brands. Deleting them outright would surprise users
  // who saved the comparison earlier.
  await admin
    .from("mait_comparisons")
    .update({ stale: true, updated_at: new Date().toISOString() })
    .contains("competitor_ids", [id]);

  // mait_organic_posts cascades automatically (FK is on delete cascade).
  const { error } = await admin
    .from("mait_competitors")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/competitors/:id]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
  revalidateTag(competitorsTag(existing.workspace_id));
  return NextResponse.json({ ok: true });
}
