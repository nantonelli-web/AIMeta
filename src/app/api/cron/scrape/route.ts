import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeMetaAds } from "@/lib/apify/service";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Vercel Cron entrypoint. Triggered by the schedules in vercel.json.
 *
 * Vercel signs each cron request with Authorization: Bearer <CRON_SECRET>.
 * If CRON_SECRET is not set, we still allow Vercel's own host header check
 * (process.env.VERCEL === "1") so the cron works on first deploy.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected) {
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const frequency = url.searchParams.get("frequency") ?? "daily";
  if (!["daily", "weekly", "manual"].includes(frequency)) {
    return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Find all competitors whose monitor_config.frequency matches.
  const { data: competitors, error } = await admin
    .from("mait_competitors")
    .select("id, workspace_id, page_id, page_url, country, monitor_config");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type CompRow = {
    id: string;
    workspace_id: string;
    page_id: string | null;
    page_url: string;
    country: string | null;
    monitor_config: { frequency?: string; max_items?: number } | null;
  };

  const due = ((competitors ?? []) as CompRow[]).filter(
    (c) => (c.monitor_config?.frequency ?? "manual") === frequency
  );

  const results: Array<{
    competitor_id: string;
    status: "ok" | "error";
    records?: number;
    error?: string;
  }> = [];

  for (const c of due) {
    const { data: job } = await admin
      .from("mait_scrape_jobs")
      .insert({
        workspace_id: c.workspace_id,
        competitor_id: c.id,
        status: "running",
      })
      .select("id")
      .single();

    if (!job) {
      results.push({ competitor_id: c.id, status: "error", error: "job_create" });
      continue;
    }

    try {
      const result = await scrapeMetaAds({
        pageId: c.page_id ?? undefined,
        pageUrl: c.page_url,
        country: c.country ?? undefined,
        maxItems: c.monitor_config?.max_items ?? 200,
        active: true,
      });

      if (result.records.length > 0) {
        const rows = result.records.map((r) => ({
          ...r,
          workspace_id: c.workspace_id,
          competitor_id: c.id,
        }));
        await admin
          .from("mait_ads_external")
          .upsert(rows, { onConflict: "workspace_id,ad_archive_id" });
      }

      await admin
        .from("mait_scrape_jobs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          records_count: result.records.length,
          cost_cu: result.costCu,
          apify_run_id: result.runId,
        })
        .eq("id", job.id);

      await admin
        .from("mait_competitors")
        .update({ last_scraped_at: new Date().toISOString() })
        .eq("id", c.id);

      if (result.records.length > 0) {
        await admin.from("mait_alerts").insert({
          workspace_id: c.workspace_id,
          competitor_id: c.id,
          type: "new_ads",
          message: `Cron ${frequency}: ${result.records.length} ads sincronizzate.`,
        });
      }

      results.push({
        competitor_id: c.id,
        status: "ok",
        records: result.records.length,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Scrape failed";
      await admin
        .from("mait_scrape_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error: message,
        })
        .eq("id", job.id);
      await admin.from("mait_alerts").insert({
        workspace_id: c.workspace_id,
        competitor_id: c.id,
        type: "sync_error",
        message: `Cron ${frequency} fallito: ${message}`,
      });
      results.push({ competitor_id: c.id, status: "error", error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    frequency,
    processed: results.length,
    results,
  });
}
