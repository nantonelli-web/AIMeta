/**
 * Infer the likely campaign objective from publicly available ad signals.
 *
 * This is an ESTIMATE, not real data. The actual campaign objective is only
 * visible to the advertiser via Meta Ads Manager / Marketing API.
 *
 * Signals used:
 * 1. ctaType (SHOP_NOW, LEARN_MORE, WATCH_MORE, INSTALL_MOBILE_APP, etc.)
 * 2. displayFormat (DPA = Dynamic Product Ads, DCO = Dynamic Creative Opt.)
 * 3. isAaaEligible (Advantage+ Creative — typically performance campaigns)
 * 4. Landing URL pattern (product page vs homepage vs app store)
 * 5. Video presence (video-first = often awareness/engagement)
 */

export type InferredObjective =
  | "sales"
  | "traffic"
  | "awareness"
  | "app_install"
  | "engagement"
  | "lead_generation"
  | "unknown";

export interface ObjectiveInference {
  objective: InferredObjective;
  confidence: number; // 0-100
  signals: string[]; // human-readable explanation of each signal used
}

const OBJECTIVE_LABELS: Record<InferredObjective, { it: string; en: string }> = {
  sales: { it: "Vendite / Conversioni", en: "Sales / Conversions" },
  traffic: { it: "Traffico", en: "Traffic" },
  awareness: { it: "Notorietà / Awareness", en: "Awareness" },
  app_install: { it: "Installazione app", en: "App Install" },
  engagement: { it: "Interazione / Engagement", en: "Engagement" },
  lead_generation: { it: "Generazione lead", en: "Lead Generation" },
  unknown: { it: "Non determinabile", en: "Not determinable" },
};

export function getObjectiveLabel(
  objective: InferredObjective,
  locale: "it" | "en"
): string {
  return OBJECTIVE_LABELS[objective]?.[locale] ?? objective;
}

interface AdSignals {
  ctaType: string | null;
  displayFormat: string | null;
  isAaaEligible: boolean;
  landingUrl: string | null;
  hasVideo: boolean;
}

function extractSignals(raw: Record<string, unknown>): AdSignals {
  const snapshot = (raw?.snapshot ?? {}) as Record<string, unknown>;
  const cards = (snapshot?.cards ?? []) as Array<Record<string, unknown>>;
  const firstCard = cards[0] ?? {};

  return {
    ctaType:
      (snapshot?.ctaType as string) ??
      (firstCard?.ctaType as string) ??
      null,
    displayFormat: (snapshot?.displayFormat as string) ?? null,
    isAaaEligible: (raw?.isAaaEligible as boolean) ?? false,
    landingUrl:
      (firstCard?.linkUrl as string) ??
      (snapshot?.linkUrl as string) ??
      null,
    hasVideo:
      !!(firstCard?.videoHdUrl || firstCard?.videoSdUrl) ||
      ((snapshot?.videos as unknown[]) ?? []).length > 0,
  };
}

function inferSingle(signals: AdSignals): {
  objective: InferredObjective;
  score: number;
  reasons: string[];
} {
  const scores: Record<InferredObjective, number> = {
    sales: 0,
    traffic: 0,
    awareness: 0,
    app_install: 0,
    engagement: 0,
    lead_generation: 0,
    unknown: 0,
  };
  const reasons: string[] = [];

  // CTA Type — strongest signal
  const cta = signals.ctaType?.toUpperCase() ?? "";
  if (cta === "SHOP_NOW" || cta === "BUY_NOW" || cta === "ORDER_NOW") {
    scores.sales += 35;
    reasons.push(`CTA "${cta}" → Sales`);
  } else if (cta === "LEARN_MORE" || cta === "SEE_MORE") {
    scores.traffic += 25;
    scores.awareness += 10;
    reasons.push(`CTA "${cta}" → Traffic/Awareness`);
  } else if (cta === "WATCH_MORE" || cta === "WATCH_VIDEO") {
    scores.awareness += 20;
    scores.engagement += 15;
    reasons.push(`CTA "${cta}" → Awareness/Engagement`);
  } else if (cta === "INSTALL_MOBILE_APP" || cta === "INSTALL_NOW" || cta === "USE_APP" || cta === "DOWNLOAD") {
    scores.app_install += 40;
    reasons.push(`CTA "${cta}" → App Install`);
  } else if (cta === "SIGN_UP" || cta === "SUBSCRIBE" || cta === "GET_QUOTE") {
    scores.lead_generation += 35;
    reasons.push(`CTA "${cta}" → Lead Generation`);
  } else if (cta === "LIKE_PAGE" || cta === "SEND_MESSAGE" || cta === "CONTACT_US") {
    scores.engagement += 30;
    reasons.push(`CTA "${cta}" → Engagement`);
  }

  // Display Format
  const fmt = signals.displayFormat?.toUpperCase() ?? "";
  if (fmt === "DPA") {
    scores.sales += 30;
    reasons.push("DPA (Dynamic Product Ads) → Sales");
  } else if (fmt === "DCO") {
    scores.sales += 15;
    scores.traffic += 10;
    reasons.push("DCO (Dynamic Creative) → Sales/Traffic");
  } else if (fmt === "VIDEO") {
    scores.awareness += 15;
    scores.engagement += 10;
    reasons.push("Video format → Awareness/Engagement");
  }

  // Advantage+
  if (signals.isAaaEligible) {
    scores.sales += 15;
    reasons.push("Advantage+ Creative attivo → Performance/Sales");
  }

  // Landing URL
  const url = (signals.landingUrl ?? "").toLowerCase();
  if (url.includes("/product") || url.includes("/p/") || url.includes("/shop") || url.includes("/buy")) {
    scores.sales += 10;
    reasons.push("Landing → pagina prodotto");
  } else if (url.includes("apps.apple") || url.includes("play.google")) {
    scores.app_install += 20;
    reasons.push("Landing → app store");
  } else if (url.includes("/blog") || url.includes("/article") || url.includes("/news")) {
    scores.traffic += 15;
    reasons.push("Landing → contenuto editoriale");
  } else if (url.includes("/contact") || url.includes("/form") || url.includes("/register")) {
    scores.lead_generation += 15;
    reasons.push("Landing → form/contatto");
  }

  // Video without shop CTA
  if (signals.hasVideo && !["SHOP_NOW", "BUY_NOW"].includes(cta)) {
    scores.awareness += 10;
    reasons.push("Video senza CTA diretta → Awareness");
  }

  // Find the winner
  let best: InferredObjective = "unknown";
  let bestScore = 0;
  for (const [obj, score] of Object.entries(scores) as [InferredObjective, number][]) {
    if (obj !== "unknown" && score > bestScore) {
      bestScore = score;
      best = obj;
    }
  }

  // Normalize confidence: max theoretical score is ~80
  const confidence = Math.min(95, Math.round((bestScore / 80) * 100));

  if (confidence < 20) {
    return { objective: "unknown", score: 0, reasons: ["Segnali insufficienti"] };
  }

  return { objective: best, score: confidence, reasons };
}

/**
 * Infer the likely campaign objective for a set of ads from the same brand.
 * Aggregates individual ad inferences and returns the dominant objective.
 */
export function inferObjective(
  adsRawData: (Record<string, unknown> | null)[]
): ObjectiveInference {
  const validAds = adsRawData.filter(Boolean) as Record<string, unknown>[];
  if (validAds.length === 0) {
    return { objective: "unknown", confidence: 0, signals: ["Nessuna ad disponibile"] };
  }

  const inferences = validAds.map((raw) => inferSingle(extractSignals(raw)));

  // Count objective votes
  const votes: Record<InferredObjective, number> = {
    sales: 0, traffic: 0, awareness: 0, app_install: 0,
    engagement: 0, lead_generation: 0, unknown: 0,
  };
  for (const inf of inferences) {
    votes[inf.objective]++;
  }

  // Find dominant
  let dominant: InferredObjective = "unknown";
  let maxVotes = 0;
  for (const [obj, count] of Object.entries(votes) as [InferredObjective, number][]) {
    if (obj !== "unknown" && count > maxVotes) {
      maxVotes = count;
      dominant = obj;
    }
  }

  // Aggregate confidence
  const matchingInferences = inferences.filter((i) => i.objective === dominant);
  const avgConfidence =
    matchingInferences.length > 0
      ? Math.round(
          matchingInferences.reduce((s, i) => s + i.score, 0) / matchingInferences.length
        )
      : 0;

  // Collect unique signals from matching inferences
  const allReasons = new Set<string>();
  for (const inf of matchingInferences.slice(0, 5)) {
    for (const r of inf.reasons) allReasons.add(r);
  }

  // Add consensus signal
  const consensusPercent = Math.round((maxVotes / validAds.length) * 100);
  allReasons.add(`${consensusPercent}% delle ads (${maxVotes}/${validAds.length}) puntano a questo obiettivo`);

  return {
    objective: dominant,
    confidence: avgConfidence,
    signals: [...allReasons],
  };
}
