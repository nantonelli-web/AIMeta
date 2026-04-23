/**
 * Extracts the "Age / Gender / EU reach" transparency fields from the raw
 * Apify payload of a Meta ad. Only populated for ads running in EU countries
 * (DSA compliance), so most non-EU ads return `{ euReach: null, ... }`.
 *
 * Field names vary slightly across actor versions — we look at multiple
 * casings (camelCase + snake_case) and tolerate missing pieces.
 */

export interface AgeGenderCount {
  ageRange: string; // "18-24", "25-34", ..., "65+"
  male: number;
  female: number;
  unknown: number;
}

export interface CountryBreakdown {
  country: string;
  ageGenderBreakdowns: AgeGenderCount[];
}

export interface AdInsights {
  /** Total EU-wide reach (accounts that saw the ad). `null` when the ad is
   *  not in the EU transparency set. */
  euReach: number | null;
  /** Overall age bucket totals (male + female + unknown per range). */
  ageTotals: { ageRange: string; count: number }[];
  /** Dominant age range label — `null` when there is no breakdown. */
  ageRangeLabel: string | null;
  /** Gender split totals (absolute counts). */
  genderTotals: { male: number; female: number; unknown: number };
  /** Localisable gender label: "all" | "mostlyMale" | "mostlyFemale". */
  genderLabel: "all" | "mostlyMale" | "mostlyFemale" | null;
  /** Reach broken down by country (best effort). */
  byCountry: { country: string; reach: number }[];
  /** True when we found ANY DSA-style breakdown. Handy to decide whether
   *  to render the insights card at all. */
  hasData: boolean;
}

const ZERO_TOTALS: AdInsights["genderTotals"] = { male: 0, female: 0, unknown: 0 };

function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function pickArray(obj: Record<string, unknown>, ...keys: string[]): unknown[] | null {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  return null;
}

export function extractAdInsights(
  rawData: Record<string, unknown> | null | undefined
): AdInsights {
  const empty: AdInsights = {
    euReach: null,
    ageTotals: [],
    ageRangeLabel: null,
    genderTotals: ZERO_TOTALS,
    genderLabel: null,
    byCountry: [],
    hasData: false,
  };
  if (!rawData) return empty;

  // Reach totals — look at both camelCase and snake_case keys, plus a
  // couple of legacy shapes seen in older Apify actor releases.
  const euReach = pickNumber(
    rawData,
    "euTotalReach",
    "eu_total_reach",
    "totalReach",
    "total_reach"
  );

  // Breakdowns live either under `ageCountryGenderReachBreakdown`
  // (DSA shape) or under `reachByAgeGender` (flat shape).
  const breakdowns = pickArray(
    rawData,
    "ageCountryGenderReachBreakdown",
    "age_country_gender_reach_breakdown",
    "reachBreakdown",
    "reach_breakdown"
  );

  if (!breakdowns || breakdowns.length === 0) {
    // Only flag hasData when there is a real number to show. An ad with
    // euReach === 0 (EU DSA row but no one saw it) was previously marked
    // hasData: true and rendered an empty "EU Reach: 0" card.
    if (euReach == null || euReach <= 0) return empty;
    return { ...empty, euReach, hasData: true };
  }

  const ageMap = new Map<string, number>();
  const gender: { male: number; female: number; unknown: number } = { male: 0, female: 0, unknown: 0 };
  const countryMap = new Map<string, number>();

  for (const entry of breakdowns) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;

    const country =
      (typeof row.country === "string" && row.country) ||
      (typeof row.countryCode === "string" && row.countryCode) ||
      null;

    const ageGenderList = pickArray(
      row,
      "ageGenderBreakdowns",
      "age_gender_breakdowns",
      "breakdowns"
    );

    if (ageGenderList) {
      for (const ag of ageGenderList) {
        if (!ag || typeof ag !== "object") continue;
        const r = ag as Record<string, unknown>;
        const ageRange =
          (typeof r.ageRange === "string" && r.ageRange) ||
          (typeof r.age_range === "string" && r.age_range) ||
          (typeof r.age === "string" && r.age) ||
          null;
        const m = pickNumber(r, "male", "m") ?? 0;
        const f = pickNumber(r, "female", "f") ?? 0;
        const u = pickNumber(r, "unknown", "u", "other") ?? 0;
        const total = m + f + u;
        if (ageRange && total > 0) {
          ageMap.set(ageRange, (ageMap.get(ageRange) ?? 0) + total);
        }
        gender.male += m;
        gender.female += f;
        gender.unknown += u;
        if (country && total > 0) {
          countryMap.set(country, (countryMap.get(country) ?? 0) + total);
        }
      }
    } else if (country) {
      // Some actors expose per-country reach without age/gender — still
      // record the aggregate so byCountry is populated.
      const total = pickNumber(row, "reach", "total_reach", "count");
      if (total != null && total > 0) {
        countryMap.set(country, (countryMap.get(country) ?? 0) + total);
      }
    }
  }

  const ageTotals = [...ageMap.entries()]
    .map(([ageRange, count]) => ({ ageRange, count }))
    .sort((a, b) => ageRangeOrder(a.ageRange) - ageRangeOrder(b.ageRange));

  const dominantAge = ageTotals.reduce<{ ageRange: string; count: number } | null>(
    (best, cur) => (best && best.count >= cur.count ? best : cur),
    null
  );

  const byCountry = [...countryMap.entries()]
    .map(([country, reach]) => ({ country, reach }))
    .sort((a, b) => b.reach - a.reach);

  const genderLabel: AdInsights["genderLabel"] = (() => {
    const paid = gender.male + gender.female;
    if (paid === 0) return null;
    const maleShare = gender.male / paid;
    if (maleShare >= 0.65) return "mostlyMale";
    if (maleShare <= 0.35) return "mostlyFemale";
    return "all";
  })();

  // Privacy-suppressed DSA rows can come back with the breakdown array
  // populated but every count zero. Treat that as "no data" instead of
  // rendering a card full of empty bars.
  const totalGenderCount = gender.male + gender.female + gender.unknown;
  const totalAgeCount = ageTotals.reduce((s, a) => s + a.count, 0);
  const hasReach = euReach != null && euReach > 0;
  const hasBreakdown = totalGenderCount > 0 || totalAgeCount > 0 || byCountry.length > 0;
  const hasData = hasReach || hasBreakdown;

  return {
    euReach,
    ageTotals,
    ageRangeLabel: dominantAge?.ageRange ?? null,
    genderTotals: gender,
    genderLabel,
    byCountry,
    hasData,
  };
}

function ageRangeOrder(range: string): number {
  // "18-24" -> 18, "65+" -> 65, "65 and above" -> 65
  const m = range.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
}

/** Summed EU reach across a set of ads. Null-safe. */
export function sumEuReach(rawDatas: (Record<string, unknown> | null | undefined)[]): number {
  let total = 0;
  for (const r of rawDatas) {
    const n = extractAdInsights(r).euReach;
    if (n != null) total += n;
  }
  return total;
}
