import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeBenchmarks,
  computeOrganicBenchmarks,
} from "@/lib/analytics/benchmarks";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const ids = sp.get("ids")?.split(",").filter(Boolean) ?? [];
  const sourceParam = sp.get("source");

  if (ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("mait_users")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  if (sourceParam === "instagram") {
    const data = await computeOrganicBenchmarks(supabase, workspaceId, ids);
    return NextResponse.json({ kind: "organic", ...data });
  }

  const validSource =
    sourceParam === "meta" || sourceParam === "google" ? sourceParam : undefined;
  const data = await computeBenchmarks(supabase, workspaceId, validSource, ids);

  return NextResponse.json({ kind: "ads", ...data });
}
