import { jsPDF } from "jspdf";
import { type ThemeConfig, DEFAULT_THEME } from "./parse-template";
import type { BrandData } from "./generate-pptx";

type Locale = "it" | "en";

// ─── Helpers ─────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function label(locale: Locale, it: string, en: string): string {
  return locale === "en" ? en : it;
}

function formatDate(locale: Locale): string {
  return new Date().toLocaleDateString(locale === "en" ? "en-GB" : "it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Page dimensions (landscape A4)
const PW = 297; // mm
const PH = 210;
const MARGIN = 15;
const CW = PW - 2 * MARGIN; // content width

/**
 * Fill the entire page with the background color.
 */
function fillBg(doc: jsPDF, theme: ThemeConfig) {
  const [r, g, b] = hexToRgb(theme.colors.background);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PW, PH, "F");
}

/**
 * Draw a horizontal colored bar chart.
 */
function drawBarChart(
  doc: jsPDF,
  items: { name: string; value: number }[],
  x: number,
  y: number,
  maxWidth: number,
  theme: ThemeConfig
) {
  if (items.length === 0) return;
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  const barHeight = 7;
  const gap = 4;

  items.forEach((item, i) => {
    const cy = y + i * (barHeight + gap);

    // Label
    const [tr, tg, tb] = hexToRgb(theme.colors.text);
    doc.setFontSize(8);
    doc.setTextColor(tr, tg, tb);
    doc.text(item.name, x, cy + barHeight / 2 + 1);

    // Bar bg
    doc.setFillColor(50, 50, 50);
    doc.rect(x + 55, cy, maxWidth - 55, barHeight, "F");

    // Bar fill
    const barW = ((maxWidth - 55) * item.value) / maxVal;
    const [pr, pg, pb] = hexToRgb(theme.colors.primary);
    doc.setFillColor(pr, pg, pb);
    doc.rect(x + 55, cy, Math.max(barW, 1), barHeight, "F");

    // Value
    doc.setFontSize(7);
    doc.setTextColor(tr, tg, tb);
    doc.text(String(item.value), x + 55 + barW + 3, cy + barHeight / 2 + 1);
  });
}

/**
 * Draw a simple "pie" as stacked proportional row (since jsPDF has no pie chart).
 */
function drawProportionalBar(
  doc: jsPDF,
  items: { name: string; value: number; color: string }[],
  x: number,
  y: number,
  width: number,
  theme: ThemeConfig
) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return;

  let cx = x;
  items.forEach((item) => {
    const w = (item.value / total) * width;
    const [r, g, b] = hexToRgb(item.color);
    doc.setFillColor(r, g, b);
    doc.rect(cx, y, w, 12, "F");
    cx += w;
  });

  // Legend
  let lx = x;
  const [tr, tg, tb] = hexToRgb(theme.colors.text);
  doc.setFontSize(7);
  doc.setTextColor(tr, tg, tb);
  items.forEach((item) => {
    const [r, g, b] = hexToRgb(item.color);
    doc.setFillColor(r, g, b);
    doc.rect(lx, y + 16, 4, 4, "F");
    const pct = Math.round((item.value / total) * 100);
    doc.text(`${item.name} (${pct}%)`, lx + 6, y + 19.5);
    lx += 50;
  });
}

// ─── Slide builders (single) ─────────────────────────────────────

function addPdfCoverPage(
  doc: jsPDF,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  fillBg(doc, theme);

  // Logo
  if (theme.logoBase64 && theme.logoMimeType) {
    try {
      const ext = theme.logoMimeType.includes("png") ? "PNG" : "JPEG";
      doc.addImage(
        `data:${theme.logoMimeType};base64,${theme.logoBase64}`,
        ext,
        MARGIN,
        15,
        40,
        40
      );
    } catch {
      // Skip logo if it fails
    }
  }

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);
  const [tr, tg, tb] = hexToRgb(theme.colors.text);

  doc.setFontSize(36);
  doc.setTextColor(pr, pg, pb);
  doc.text(brand.name, MARGIN, 85);

  doc.setFontSize(18);
  doc.setTextColor(tr, tg, tb);
  doc.text(label(locale, "Report Analisi Ads", "Ads Analysis Report"), MARGIN, 100);

  doc.setFontSize(12);
  doc.setTextColor(tr, tg, tb);
  doc.text(formatDate(locale), MARGIN, 115);

  doc.setFontSize(10);
  doc.setTextColor(pr, pg, pb);
  doc.text("Powered by MAIT", MARGIN, 185);
}

function addPdfOverviewPage(
  doc: jsPDF,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);
  const [tr, tg, tb] = hexToRgb(theme.colors.text);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(label(locale, "Panoramica", "Overview"), MARGIN, 25);

  const total = brand.imageCount + brand.videoCount + brand.carouselCount;
  const formatMix =
    total > 0
      ? `${Math.round((brand.imageCount / total) * 100)}% Image, ${Math.round((brand.videoCount / total) * 100)}% Video, ${Math.round((brand.carouselCount / total) * 100)}% Carousel`
      : "\u2014";

  const rows: [string, string][] = [
    [label(locale, "Ads totali", "Total ads"), String(brand.totalAds)],
    [label(locale, "Ads attive", "Active ads"), String(brand.activeAds)],
    [label(locale, "Format mix", "Format mix"), formatMix],
    [
      label(locale, "Ultimo scan", "Last scan"),
      brand.lastScrapedAt
        ? new Date(brand.lastScrapedAt).toLocaleDateString(locale === "en" ? "en-GB" : "it-IT")
        : "\u2014",
    ],
  ];

  let y = 42;
  rows.forEach(([lbl, val]) => {
    doc.setFontSize(12);
    doc.setTextColor(tr, tg, tb);
    doc.text(lbl, MARGIN, y);

    doc.setFontSize(14);
    doc.setTextColor(pr, pg, pb);
    doc.text(val, MARGIN + 90, y);

    y += 16;
  });
}

function addPdfObjectivePage(
  doc: jsPDF,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);
  const [tr, tg, tb] = hexToRgb(theme.colors.text);
  const obj = brand.objectiveInference;

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(
    label(locale, "Obiettivo Campagna (stimato)", "Campaign Objective (estimated)"),
    MARGIN,
    25
  );

  doc.setFontSize(20);
  doc.setTextColor(tr, tg, tb);
  doc.text(obj.objective.replace(/_/g, " ").toUpperCase(), MARGIN, 50);

  // Confidence bar
  doc.setFillColor(50, 50, 50);
  doc.rect(MARGIN, 58, 150, 6, "F");
  doc.setFillColor(pr, pg, pb);
  doc.rect(MARGIN, 58, 150 * (obj.confidence / 100), 6, "F");

  doc.setFontSize(10);
  doc.setTextColor(tr, tg, tb);
  doc.text(
    `${label(locale, "Confidenza", "Confidence")}: ${obj.confidence}%`,
    MARGIN + 155,
    63
  );

  // Signals
  doc.setFontSize(9);
  doc.setTextColor(tr, tg, tb);
  let y = 78;
  doc.text(`${label(locale, "Segnali", "Signals")}:`, MARGIN, y);
  y += 8;
  obj.signals.forEach((s) => {
    doc.text(`\u2022 ${s}`, MARGIN + 4, y);
    y += 6;
  });
}

function addPdfFormatPage(
  doc: jsPDF,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(
    label(locale, "Distribuzione Formati", "Format Distribution"),
    MARGIN,
    25
  );

  drawProportionalBar(
    doc,
    [
      { name: "Image", value: brand.imageCount, color: theme.colors.primary },
      { name: "Video", value: brand.videoCount, color: theme.colors.secondary },
      { name: "Carousel", value: brand.carouselCount, color: theme.colors.accent },
    ],
    MARGIN,
    45,
    CW,
    theme
  );
}

function addPdfCtaPage(
  doc: jsPDF,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(label(locale, "Top CTA", "Top CTAs"), MARGIN, 25);

  drawBarChart(
    doc,
    brand.topCtas.slice(0, 8).map((c) => ({ name: c.name, value: c.count })),
    MARGIN,
    40,
    CW,
    theme
  );
}

function addPdfPlatformPage(
  doc: jsPDF,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(
    label(locale, "Distribuzione Piattaforme", "Platform Distribution"),
    MARGIN,
    25
  );

  const palette = [
    theme.colors.primary,
    theme.colors.secondary,
    theme.colors.accent,
    "#8a6bb0",
    "#5ba09b",
    "#a06b5b",
  ];

  drawProportionalBar(
    doc,
    brand.platforms.map((p, i) => ({
      name: p.name,
      value: p.count,
      color: palette[i % palette.length],
    })),
    MARGIN,
    45,
    CW,
    theme
  );
}

function addPdfStatsPage(
  doc: jsPDF,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);
  const [tr, tg, tb] = hexToRgb(theme.colors.text);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(
    label(locale, "Durata Campagna & Lunghezza Copy", "Campaign Duration & Copy Length"),
    MARGIN,
    25
  );

  const stats: [string, string][] = [
    [
      label(locale, "Durata media campagna", "Avg. campaign duration"),
      brand.avgDuration > 0
        ? `${brand.avgDuration} ${label(locale, "giorni", "days")}`
        : "\u2014",
    ],
    [
      label(locale, "Lunghezza media copy", "Avg. copy length"),
      brand.avgCopyLength > 0
        ? `${brand.avgCopyLength} ${label(locale, "caratteri", "chars")}`
        : "\u2014",
    ],
    [
      label(locale, "Refresh rate (90gg)", "Refresh rate (90d)"),
      brand.adsPerWeek > 0
        ? `${brand.adsPerWeek} ${label(locale, "ads/settimana", "ads/week")}`
        : "\u2014",
    ],
  ];

  let y = 50;
  stats.forEach(([lbl, val]) => {
    doc.setFontSize(11);
    doc.setTextColor(tr, tg, tb);
    doc.text(lbl, MARGIN, y);

    doc.setFontSize(22);
    doc.setTextColor(pr, pg, pb);
    doc.text(val, MARGIN, y + 14);

    y += 35;
  });
}

function addPdfLatestAdsPage(
  doc: jsPDF,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);
  const [tr, tg, tb] = hexToRgb(theme.colors.text);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(label(locale, "Ultime Ads", "Latest Ads"), MARGIN, 25);

  const ads = brand.latestAds.slice(0, 6);
  let y = 42;
  ads.forEach((ad) => {
    const headline = ad.headline ?? `Ad #${ad.ad_archive_id.slice(0, 8)}`;

    // Card bg
    doc.setFillColor(26, 26, 26);
    doc.roundedRect(MARGIN, y - 4, CW, 14, 2, 2, "F");

    // Border
    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y - 4, CW, 14, 2, 2, "S");

    doc.setFontSize(10);
    doc.setTextColor(tr, tg, tb);
    doc.text(headline, MARGIN + 4, y + 4);

    y += 18;
  });
}

function addPdfClosingPage(
  doc: jsPDF,
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  if (theme.logoBase64 && theme.logoMimeType) {
    try {
      const ext = theme.logoMimeType.includes("png") ? "PNG" : "JPEG";
      doc.addImage(
        `data:${theme.logoMimeType};base64,${theme.logoBase64}`,
        ext,
        PW / 2 - 20,
        40,
        40,
        40
      );
    } catch {
      // Skip logo
    }
  }

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);
  const [tr, tg, tb] = hexToRgb(theme.colors.text);

  doc.setFontSize(28);
  doc.setTextColor(pr, pg, pb);
  doc.text(label(locale, "Grazie.", "Thank you."), PW / 2, 110, {
    align: "center",
  });

  doc.setFontSize(10);
  doc.setTextColor(tr, tg, tb);
  doc.text("Powered by MAIT \u00B7 NIMA Digital", PW / 2, 130, {
    align: "center",
  });
}

// ─── Comparison pages ────────────────────────────────────────────

function addPdfComparisonCover(
  doc: jsPDF,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  fillBg(doc, theme);

  if (theme.logoBase64 && theme.logoMimeType) {
    try {
      const ext = theme.logoMimeType.includes("png") ? "PNG" : "JPEG";
      doc.addImage(
        `data:${theme.logoMimeType};base64,${theme.logoBase64}`,
        ext,
        MARGIN,
        15,
        40,
        40
      );
    } catch {
      // Skip
    }
  }

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);
  const [tr, tg, tb] = hexToRgb(theme.colors.text);

  doc.setFontSize(30);
  doc.setTextColor(pr, pg, pb);
  doc.text(brands.map((b) => b.name).join(" vs "), MARGIN, 85);

  doc.setFontSize(18);
  doc.setTextColor(tr, tg, tb);
  doc.text(
    label(locale, "Report Confronto Brand", "Brand Comparison Report"),
    MARGIN,
    100
  );

  doc.setFontSize(12);
  doc.setTextColor(tr, tg, tb);
  doc.text(formatDate(locale), MARGIN, 115);

  doc.setFontSize(10);
  doc.setTextColor(pr, pg, pb);
  doc.text("Powered by MAIT", MARGIN, 185);
}

function addPdfComparisonOverview(
  doc: jsPDF,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);
  const [tr, tg, tb] = hexToRgb(theme.colors.text);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(label(locale, "Panoramica Comparativa", "Comparative Overview"), MARGIN, 25);

  const colW = CW / (brands.length + 1);
  let y = 45;

  // Header row
  doc.setFontSize(10);
  doc.setTextColor(pr, pg, pb);
  brands.forEach((b, i) => {
    doc.text(b.name, MARGIN + colW * (i + 1), y, { maxWidth: colW - 5 });
  });

  const metrics: [string, (b: BrandData) => string][] = [
    [label(locale, "Ads totali", "Total ads"), (b) => String(b.totalAds)],
    [label(locale, "Ads attive", "Active ads"), (b) => String(b.activeAds)],
    [label(locale, "Durata media", "Avg. duration"), (b) => b.avgDuration > 0 ? `${b.avgDuration}d` : "\u2014"],
    [label(locale, "Lungh. copy", "Copy length"), (b) => b.avgCopyLength > 0 ? `${b.avgCopyLength}` : "\u2014"],
    [label(locale, "Refresh rate", "Refresh rate"), (b) => b.adsPerWeek > 0 ? `${b.adsPerWeek}/wk` : "\u2014"],
  ];

  y += 14;
  metrics.forEach(([lbl, fn]) => {
    // Separator line
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y - 3, MARGIN + CW, y - 3);

    doc.setFontSize(9);
    doc.setTextColor(tr, tg, tb);
    doc.text(lbl, MARGIN, y + 2);

    doc.setTextColor(pr, pg, pb);
    brands.forEach((b, i) => {
      doc.text(fn(b), MARGIN + colW * (i + 1), y + 2);
    });

    y += 14;
  });
}

function addPdfComparisonObjectives(
  doc: jsPDF,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);
  const [tr, tg, tb] = hexToRgb(theme.colors.text);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(
    label(locale, "Obiettivi Campagna (stimati)", "Campaign Objectives (estimated)"),
    MARGIN,
    25
  );

  const colW = CW / brands.length;

  brands.forEach((b, i) => {
    const x = MARGIN + i * colW;
    const obj = b.objectiveInference;

    doc.setFontSize(11);
    doc.setTextColor(pr, pg, pb);
    doc.text(b.name, x, 48);

    doc.setFontSize(14);
    doc.setTextColor(tr, tg, tb);
    doc.text(obj.objective.replace(/_/g, " ").toUpperCase(), x, 62);

    // Confidence bar
    doc.setFillColor(50, 50, 50);
    doc.rect(x, 68, colW - 10, 5, "F");
    doc.setFillColor(pr, pg, pb);
    doc.rect(x, 68, (colW - 10) * (obj.confidence / 100), 5, "F");

    doc.setFontSize(8);
    doc.setTextColor(tr, tg, tb);
    doc.text(`${obj.confidence}%`, x, 82);
  });
}

function addPdfComparisonFormat(
  doc: jsPDF,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(
    label(locale, "Distribuzione Formati", "Format Distribution"),
    MARGIN,
    25
  );

  const colW = CW / brands.length;

  brands.forEach((b, i) => {
    const x = MARGIN + i * colW;

    doc.setFontSize(10);
    doc.setTextColor(pr, pg, pb);
    doc.text(b.name, x, 42);

    drawProportionalBar(
      doc,
      [
        { name: "Img", value: b.imageCount, color: theme.colors.primary },
        { name: "Vid", value: b.videoCount, color: theme.colors.secondary },
        { name: "Car", value: b.carouselCount, color: theme.colors.accent },
      ],
      x,
      50,
      colW - 10,
      theme
    );
  });
}

function addPdfComparisonCta(
  doc: jsPDF,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);
  const [tr, tg, tb] = hexToRgb(theme.colors.text);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(label(locale, "Top CTA per Brand", "Top CTAs per Brand"), MARGIN, 25);

  const colW = CW / brands.length;

  brands.forEach((b, i) => {
    const x = MARGIN + i * colW;

    doc.setFontSize(10);
    doc.setTextColor(pr, pg, pb);
    doc.text(b.name, x, 42);

    let y = 52;
    doc.setFontSize(9);
    doc.setTextColor(tr, tg, tb);
    b.topCtas.slice(0, 5).forEach((cta) => {
      doc.text(`${cta.name} (${cta.count})`, x, y);
      y += 8;
    });
  });
}

function addPdfComparisonRefresh(
  doc: jsPDF,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(
    label(locale, "Refresh Rate (90 giorni)", "Refresh Rate (90 days)"),
    MARGIN,
    25
  );

  drawBarChart(
    doc,
    brands.map((b) => ({ name: b.name, value: b.adsPerWeek })),
    MARGIN,
    45,
    CW,
    theme
  );
}

function addPdfComparisonLatestAds(
  doc: jsPDF,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  doc.addPage();
  fillBg(doc, theme);

  const [pr, pg, pb] = hexToRgb(theme.colors.primary);
  const [tr, tg, tb] = hexToRgb(theme.colors.text);

  doc.setFontSize(24);
  doc.setTextColor(pr, pg, pb);
  doc.text(label(locale, "Ultime Ads per Brand", "Latest Ads per Brand"), MARGIN, 25);

  const colW = CW / brands.length;

  brands.forEach((b, i) => {
    const x = MARGIN + i * colW;

    doc.setFontSize(10);
    doc.setTextColor(pr, pg, pb);
    doc.text(b.name, x, 42);

    let y = 52;
    b.latestAds.slice(0, 4).forEach((ad) => {
      const headline = ad.headline ?? `Ad #${ad.ad_archive_id.slice(0, 8)}`;

      doc.setFillColor(26, 26, 26);
      doc.roundedRect(x, y - 4, colW - 10, 12, 1, 1, "F");

      doc.setDrawColor(pr, pg, pb);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y - 4, colW - 10, 12, 1, 1, "S");

      doc.setFontSize(8);
      doc.setTextColor(tr, tg, tb);
      doc.text(headline, x + 3, y + 3, { maxWidth: colW - 16 });

      y += 16;
    });
  });
}

// ─── Main entry points ──────────────────────────────────────────

export async function generateSinglePdf(
  brand: BrandData,
  theme?: ThemeConfig | null,
  locale: Locale = "it"
): Promise<ArrayBuffer> {
  const t = theme ?? DEFAULT_THEME;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  addPdfCoverPage(doc, brand, t, locale);
  addPdfOverviewPage(doc, brand, t, locale);
  addPdfObjectivePage(doc, brand, t, locale);
  addPdfFormatPage(doc, brand, t, locale);
  addPdfCtaPage(doc, brand, t, locale);
  addPdfPlatformPage(doc, brand, t, locale);
  addPdfStatsPage(doc, brand, t, locale);
  addPdfLatestAdsPage(doc, brand, t, locale);
  addPdfClosingPage(doc, t, locale);

  return doc.output("arraybuffer");
}

export async function generateComparisonPdf(
  brands: BrandData[],
  theme?: ThemeConfig | null,
  locale: Locale = "it"
): Promise<ArrayBuffer> {
  const t = theme ?? DEFAULT_THEME;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  addPdfComparisonCover(doc, brands, t, locale);
  addPdfComparisonOverview(doc, brands, t, locale);
  addPdfComparisonObjectives(doc, brands, t, locale);
  addPdfComparisonFormat(doc, brands, t, locale);
  addPdfComparisonCta(doc, brands, t, locale);
  addPdfComparisonRefresh(doc, brands, t, locale);
  addPdfComparisonLatestAds(doc, brands, t, locale);
  addPdfClosingPage(doc, t, locale);

  return doc.output("arraybuffer");
}
