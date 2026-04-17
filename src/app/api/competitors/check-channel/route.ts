import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/competitors/check-channel?ids=X,Y,Z&channel=google
 * Returns ad count per competitor for the given channel.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const channel = url.searchParams.get("channel") ?? "meta";

  if (ids.length === 0)
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });

  const results: { id: string; count: number }[] = [];

  if (channel === "instagram") {
    // Check organic posts
    for (const id of ids) {
      const { count } = await supabase
        .from("mait_organic_posts")
        .select("id", { count: "exact", head: true })
        .eq("competitor_id", id);
      results.push({ id, count: count ?? 0 });
    }
  } else {
    // Check ads by source
    const source = channel === "all" ? undefined : channel;
    for (const id of ids) {
      let q = supabase
        .from("mait_ads_external")
        .select("id", { count: "exact", head: true })
        .eq("competitor_id", id);
      if (source) q = q.eq("source", source);
      const { count } = await q;
      results.push({ id, count: count ?? 0 });
    }
  }

  return NextResponse.json({ results });
}
