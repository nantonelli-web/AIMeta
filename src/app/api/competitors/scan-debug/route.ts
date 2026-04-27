import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns the competitor row + the last 10 scrape_jobs for a given
 * competitor id, so we can see exactly why a scan is silent / does
 * not update last_scraped_at.
 *
 * Common failure modes the response surfaces:
 *   - status = "running" with old started_at  → Lambda timed out or
 *     the orchestrator threw before reaching the success branch
 *   - status = "failed" + error                → Apify rejected the
 *     run or the actor exited non-SUCCEEDED
 *   - status = "succeeded" + records_count = 0 → Apify completed but
 *     returned an empty dataset (page_id wrong, page deleted, etc.)
 *
 * GET /api/competitors/scan-debug?id=<competitor_id>
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const competitorId = url.searchParams.get("id");
    if (!competitorId) {
      return NextResponse.json(
        { error: "Missing ?id=<competitor_id>" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user ?? null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("mait_users")
      .select("workspace_id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (
      !profile?.workspace_id ||
      !["super_admin", "admin"].includes(profile.role)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    const [{ data: competitor }, { data: jobs }] = await Promise.all([
      admin
        .from("mait_competitors")
        .select(
          "id, workspace_id, page_name, page_id, page_url, country, monitor_config, last_scraped_at, instagram_username, google_advertiser_id, google_domain, profile_picture_url, created_at",
        )
        .eq("id", competitorId)
        .eq("workspace_id", profile.workspace_id)
        .maybeSingle(),
      admin
        .from("mait_scrape_jobs")
        .select(
          "id, status, started_at, completed_at, records_count, cost_cu, error, apify_run_id, date_from, date_to",
        )
        .eq("workspace_id", profile.workspace_id)
        .eq("competitor_id", competitorId)
        .order("started_at", { ascending: false })
        .limit(10),
    ]);

    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found in this workspace" },
        { status: 404 },
      );
    }

    const now = Date.now();
    const annotatedJobs = (jobs ?? []).map((j) => {
      const startedAtMs = j.started_at ? new Date(j.started_at).getTime() : null;
      const ageMin =
        startedAtMs !== null
          ? Math.round((now - startedAtMs) / 60000)
          : null;
      const stuckRunning =
        j.status === "running" && ageMin !== null && ageMin > 10;
      return {
        ...j,
        ageMinutes: ageMin,
        likelyStuck: stuckRunning,
      };
    });

    const summary = {
      lastJob: annotatedJobs[0] ?? null,
      runningCount: annotatedJobs.filter((j) => j.status === "running").length,
      failedCount: annotatedJobs.filter((j) => j.status === "failed").length,
      succeededCount: annotatedJobs.filter((j) => j.status === "succeeded")
        .length,
      mostRecentSucceeded:
        annotatedJobs.find((j) => j.status === "succeeded") ?? null,
    };

    return NextResponse.json({
      ok: true,
      competitor,
      summary,
      jobs: annotatedJobs,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[scan-debug]", e);
    return NextResponse.json(
      { error: "Server error", detail: message },
      { status: 500 },
    );
  }
}
