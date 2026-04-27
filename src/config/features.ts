/**
 * Feature flags. Centralised so disabling a half-baked feature is one
 * file change instead of N component edits, and so re-enabling later
 * doesn't require hunting for every UI surface that references it.
 *
 * Each flag should keep a short note explaining WHY it is in its
 * current state — so a future read of the file tells the whole story.
 */

/**
 * AI Tagging surface (button to classify ads + post-classification
 * badges on cards + "AI Tags" card on the ad detail page).
 *
 * Off because the classification was largely redundant with the real
 * data Apify already gives us (sector ≈ brand category, format ≈
 * displayFormat, objective often readable from the CTA), and the
 * genuinely-new fields (tone, seasonality, language) were never
 * wired into any filter, chart or aggregation. The tags were just
 * decorative badges with a per-batch credit + OpenRouter cost.
 *
 * Flip back to true once we either (a) plumb tone/objective into
 * Library/Benchmarks filters, or (b) auto-run tagging on scan
 * completion so the user never sees the "X ads to analyze" prompt.
 *
 * Backend stays intact (`/api/ai/tag`, `/api/ai/tag/count`,
 * `lib/ai/tagger.ts`, `mait_tags` / `mait_ads_tags` tables). Only
 * the UI surfaces are hidden.
 */
export const AI_TAGS_ENABLED = false;
