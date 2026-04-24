import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Diagnostic for the ad-level country filter. Confirms whether
 * `raw_data.targetedOrReachedCountries` exists on real ads, and what
 * the values look like (ISO-2 vs names vs casing). The ad-level FR
 * filter is returning zero for every brand — this probe tells us why
 * without guessing.
 *
 * GET /api/competitors/targeted-countries-debug
 * Optional: ?source=meta|google (default: meta)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const source = url.searchParams.get("source") ?? "meta";

    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user ?? null;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("mait_users")
      .select("workspace_id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.workspace_id || !["super_admin", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const workspaceId = profile.workspace_id;
    const admin = createAdminClient();

    // Paginated fetch of raw_data — same pagination shape as benchmarks,
    // so we see exactly what the analytics code sees.
    async function fetchAll(): Promise<
      { id: string; competitor_id: string | null; raw_data: Record<string, unknown> | null }[]
    > {
      const PAGE = 1000;
      const SAFETY_CAP = 15_000;
      const rows: { id: string; competitor_id: string | null; raw_data: Record<string, unknown> | null }[] = [];
      for (let from = 0; from < SAFETY_CAP; from += PAGE) {
        const { data, error } = await admin
          .from("mait_ads_external")
          .select("id, competitor_id, raw_data")
          .eq("workspace_id", workspaceId)
          .eq("source", source)
          .order("id")
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        rows.push(...(data as typeof rows));
        if (data.length < PAGE) break;
      }
      return rows;
    }

    // Separate probe using the JSON path select the benchmarks use. If
    // PostgREST silently returns nulls here while the raw_data fetch has
    // the field, the issue is the `->` operator itself (e.g. the key is
    // nested somewhere else or stored under a different name).
    async function fetchViaJsonPath(): Promise<
      { id: string; targetedCountries: unknown }[]
    > {
      const { data, error } = await admin
        .from("mait_ads_external")
        .select("id, targetedCountries:raw_data->targetedOrReachedCountries")
        .eq("workspace_id", workspaceId)
        .eq("source", source)
        .order("id")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as { id: string; targetedCountries: unknown }[];
    }

    const [rows, jsonPathSample] = await Promise.all([fetchAll(), fetchViaJsonPath()]);

    // Find the first raw_data and dump its keys so we can see what Meta
    // actually returns at the top level.
    const firstRawKeys = rows.length > 0 && rows[0].raw_data
      ? Object.keys(rows[0].raw_data).sort()
      : [];

    // ── Extra probes for alternative country-bearing fields ──
    // We already know `targetedOrReachedCountries` is always []. Look at
    // the other plausible sources so we can tell what Meta/Apify DOES
    // give us, and pick the best signal for a per-ad country.

    // 1) inputUrl — the scan URL we passed Apify. Contains `country=XX`
    //    or `country=ALL`. When single-country it IS the per-ad country.
    const inputUrlCountryTally = new Map<string, number>();
    let inputUrlPresent = 0;
    let inputUrlParseable = 0;
    const inputUrlSamples: string[] = [];

    // 2) regionalRegulationData — Meta's per-region regulation info.
    //    Often carries a country code / list.
    let regulationPresent = 0;
    const regulationShapeSamples: string[] = [];

    // 3) reachEstimate — sometimes a number, sometimes an object with
    //    per-country keys.
    let reachEstimatePresent = 0;
    const reachEstimateShapeSamples: string[] = [];

    // 4) ageCountryGenderReachBreakdown — DSA per-country breakdown.
    //    If non-empty, it lists the countries the ad actually reached.
    const dsaCountryTally = new Map<string, number>();
    let dsaPresent = 0;

    for (const r of rows) {
      const raw = r.raw_data;
      if (!raw) continue;
      const rec = raw as Record<string, unknown>;

      const inputUrl = rec.inputUrl;
      if (typeof inputUrl === "string" && inputUrl) {
        inputUrlPresent++;
        if (inputUrlSamples.length < 6) inputUrlSamples.push(inputUrl.slice(0, 200));
        try {
          const c = new URL(inputUrl).searchParams.get("country");
          if (c) {
            inputUrlParseable++;
            inputUrlCountryTally.set(c, (inputUrlCountryTally.get(c) ?? 0) + 1);
          }
        } catch {
          // skip malformed URL
        }
      }

      const reg = rec.regionalRegulationData;
      if (reg !== undefined && reg !== null) {
        regulationPresent++;
        if (regulationShapeSamples.length < 3) {
          regulationShapeSamples.push(JSON.stringify(reg).slice(0, 300));
        }
      }

      const re = rec.reachEstimate;
      if (re !== undefined && re !== null) {
        reachEstimatePresent++;
        if (reachEstimateShapeSamples.length < 3) {
          reachEstimateShapeSamples.push(JSON.stringify(re).slice(0, 300));
        }
      }

      const dsa = rec.ageCountryGenderReachBreakdown;
      if (Array.isArray(dsa) && dsa.length > 0) {
        dsaPresent++;
        for (const entry of dsa) {
          if (entry && typeof entry === "object") {
            const country =
              (entry as Record<string, unknown>).country ??
              (entry as Record<string, unknown>).countryCode;
            if (typeof country === "string" && country) {
              dsaCountryTally.set(country, (dsaCountryTally.get(country) ?? 0) + 1);
            }
          }
        }
      }
    }

    const inputUrlTop = [...inputUrlCountryTally.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }));
    const dsaTop = [...dsaCountryTally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([country, count]) => ({ country, count }));

    // Scan raw_data for every plausible country-like field name so we
    // can confirm the field is where we think it is (and not under a
    // different casing / prefix / nesting).
    const CANDIDATE_KEYS = [
      "targetedOrReachedCountries",
      "targeted_or_reached_countries",
      "targetedCountries",
      "targeting_countries",
      "target_countries",
      "countries",
      "country",
      "reachedCountries",
    ];
    const presenceByKey = new Map<string, { nonEmptyCount: number; sampleValues: string[] }>();
    for (const k of CANDIDATE_KEYS) {
      presenceByKey.set(k, { nonEmptyCount: 0, sampleValues: [] });
    }
    // Global tally of every distinct value observed inside
    // targetedOrReachedCountries, so we can see if values are ISO-2
    // ("FR"), alpha-3 ("FRA"), or names ("France"/"france").
    const valueTally = new Map<string, number>();

    let withRawData = 0;
    let withTargeted = 0;
    let arrayShapeCount = 0;
    let emptyArrayCount = 0;

    for (const r of rows) {
      const raw = r.raw_data;
      if (!raw) continue;
      withRawData++;
      for (const k of CANDIDATE_KEYS) {
        const v = (raw as Record<string, unknown>)[k];
        const entry = presenceByKey.get(k)!;
        if (v !== undefined && v !== null) {
          // "non-empty" is loosely: not null/undefined. Arrays of 0 still count.
          entry.nonEmptyCount++;
          if (entry.sampleValues.length < 5) {
            // Truncate huge values so the payload stays small.
            const sample =
              typeof v === "string"
                ? v.slice(0, 80)
                : JSON.stringify(v).slice(0, 120);
            entry.sampleValues.push(sample);
          }
        }
      }
      const t = (raw as { targetedOrReachedCountries?: unknown }).targetedOrReachedCountries;
      if (t !== undefined && t !== null) withTargeted++;
      if (Array.isArray(t)) {
        arrayShapeCount++;
        if (t.length === 0) emptyArrayCount++;
        for (const v of t) {
          if (typeof v === "string") {
            valueTally.set(v, (valueTally.get(v) ?? 0) + 1);
          }
        }
      }
    }

    const topValues = [...valueTally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([value, count]) => ({ value, count }));

    // Separately: how often does the JSON path select return something
    // non-null? Any mismatch between this count and the raw_data count
    // means PostgREST is not seeing the key where we think it is.
    const jsonPathNonNull = jsonPathSample.filter(
      (r) => r.targetedCountries !== null && r.targetedCountries !== undefined
    ).length;
    const jsonPathSampleSmall = jsonPathSample.slice(0, 8).map((r) => ({
      id: r.id,
      targetedCountries: r.targetedCountries,
    }));

    return NextResponse.json({
      ok: true,
      source,
      counts: {
        totalRowsScanned: rows.length,
        withRawData,
        withTargetedOrReachedCountries: withTargeted,
        arrayShape: arrayShapeCount,
        emptyArrays: emptyArrayCount,
      },
      jsonPathProbe: {
        sampleSize: jsonPathSample.length,
        nonNull: jsonPathNonNull,
        sample: jsonPathSampleSmall,
      },
      candidateKeysPresence: [...presenceByKey.entries()].map(([key, v]) => ({
        key,
        nonEmptyCount: v.nonEmptyCount,
        sampleValues: v.sampleValues,
      })),
      topCountryValues: topValues,
      firstRowTopLevelKeys: firstRawKeys,
      inputUrl: {
        present: inputUrlPresent,
        parseable: inputUrlParseable,
        countryTally: inputUrlTop,
        samples: inputUrlSamples,
      },
      regionalRegulationData: {
        present: regulationPresent,
        samples: regulationShapeSamples,
      },
      reachEstimate: {
        present: reachEstimatePresent,
        samples: reachEstimateShapeSamples,
      },
      dsaBreakdown: {
        present: dsaPresent,
        countryTally: dsaTop,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[targeted-countries-debug]", e);
    return NextResponse.json({ error: "Server error", detail: message }, { status: 500 });
  }
}
