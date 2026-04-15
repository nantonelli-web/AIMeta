import PptxGenJS from "pptxgenjs";
import { type ThemeConfig, DEFAULT_THEME } from "./parse-template";

// ─── Types ───────────────────────────────────────────────────────

export interface BrandData {
  id: string;
  name: string;
  totalAds: number;
  activeAds: number;
  imageCount: number;
  videoCount: number;
  carouselCount: number;
  topCtas: { name: string; count: number }[];
  platforms: { name: string; count: number }[];
  avgDuration: number;
  avgCopyLength: number;
  adsPerWeek: number;
  lastScrapedAt: string | null;
  objectiveInference: {
    objective: string;
    confidence: number;
    signals: string[];
  };
  latestAds: {
    headline: string | null;
    image_url: string | null;
    ad_archive_id: string;
  }[];
}

type Locale = "it" | "en";

// ─── Helpers ─────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  // pptxgenjs accepts hex WITHOUT the '#' prefix
  return hex.replace("#", "");
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

// ─── Slide builders (single) ─────────────────────────────────────

function addCoverSlide(
  pptx: PptxGenJS,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  // Logo
  if (theme.logoBase64 && theme.logoMimeType) {
    slide.addImage({
      data: `data:${theme.logoMimeType};base64,${theme.logoBase64}`,
      x: 0.5,
      y: 0.4,
      w: 1.5,
      h: 1.5,
      sizing: { type: "contain", w: 1.5, h: 1.5 },
    });
  }

  slide.addText(brand.name, {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 1.2,
    fontSize: 36,
    fontFace: theme.fonts.heading,
    color: hexToRgb(theme.colors.primary),
    bold: true,
  });

  slide.addText(
    label(locale, "Report Analisi Ads", "Ads Analysis Report"),
    {
      x: 0.5,
      y: 3.3,
      w: 9,
      h: 0.6,
      fontSize: 18,
      fontFace: theme.fonts.body,
      color: hexToRgb(theme.colors.text),
    }
  );

  slide.addText(formatDate(locale), {
    x: 0.5,
    y: 4.0,
    w: 9,
    h: 0.4,
    fontSize: 12,
    fontFace: theme.fonts.body,
    color: hexToRgb(theme.colors.text),
    transparency: 40,
  });

  slide.addText("Powered by MAIT", {
    x: 0.5,
    y: 4.8,
    w: 9,
    h: 0.3,
    fontSize: 10,
    fontFace: theme.fonts.body,
    color: hexToRgb(theme.colors.primary),
    transparency: 50,
  });
}

function addOverviewSlide(
  pptx: PptxGenJS,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(label(locale, "Panoramica", "Overview"), {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: 24,
    fontFace: theme.fonts.heading,
    color: hexToRgb(theme.colors.primary),
    bold: true,
  });

  const total = brand.imageCount + brand.videoCount + brand.carouselCount;
  const formatMix =
    total > 0
      ? `${Math.round((brand.imageCount / total) * 100)}% Image, ${Math.round((brand.videoCount / total) * 100)}% Video, ${Math.round((brand.carouselCount / total) * 100)}% Carousel`
      : "—";

  const rows: [string, string][] = [
    [label(locale, "Ads totali", "Total ads"), String(brand.totalAds)],
    [label(locale, "Ads attive", "Active ads"), String(brand.activeAds)],
    [label(locale, "Format mix", "Format mix"), formatMix],
    [
      label(locale, "Ultimo scan", "Last scan"),
      brand.lastScrapedAt
        ? new Date(brand.lastScrapedAt).toLocaleDateString(locale === "en" ? "en-GB" : "it-IT")
        : "—",
    ],
  ];

  const tableRows: PptxGenJS.TableRow[] = rows.map(([lbl, val]) => [
    {
      text: lbl,
      options: {
        fontSize: 13,
        fontFace: theme.fonts.body,
        color: hexToRgb(theme.colors.text),
        fill: { color: hexToRgb(theme.colors.background) },
        border: { type: "none" as const },
        transparency: 30,
      },
    },
    {
      text: val,
      options: {
        fontSize: 13,
        fontFace: theme.fonts.body,
        color: hexToRgb(theme.colors.primary),
        bold: true,
        fill: { color: hexToRgb(theme.colors.background) },
        border: { type: "none" as const },
      },
    },
  ]);

  slide.addTable(tableRows, {
    x: 0.5,
    y: 1.2,
    w: 9,
    colW: [4.5, 4.5],
    rowH: 0.6,
  });
}

function addObjectiveSlide(
  pptx: PptxGenJS,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(
    label(locale, "Obiettivo Campagna (stimato)", "Campaign Objective (estimated)"),
    {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 24,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.primary),
      bold: true,
    }
  );

  const obj = brand.objectiveInference;

  slide.addText(obj.objective.replace(/_/g, " ").toUpperCase(), {
    x: 0.5,
    y: 1.3,
    w: 9,
    h: 0.6,
    fontSize: 20,
    fontFace: theme.fonts.heading,
    color: hexToRgb(theme.colors.text),
    bold: true,
  });

  // Confidence bar background
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 2.1,
    w: 6,
    h: 0.3,
    fill: { color: "333333" },
    line: { type: "none" },
  });

  // Confidence bar fill
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 2.1,
    w: 6 * (obj.confidence / 100),
    h: 0.3,
    fill: { color: hexToRgb(theme.colors.primary) },
    line: { type: "none" },
  });

  slide.addText(`${label(locale, "Confidenza", "Confidence")}: ${obj.confidence}%`, {
    x: 6.7,
    y: 2.05,
    w: 3,
    h: 0.4,
    fontSize: 12,
    fontFace: theme.fonts.body,
    color: hexToRgb(theme.colors.text),
  });

  // Signals
  const signalText = obj.signals.map((s) => `  \u2022 ${s}`).join("\n");
  slide.addText(
    `${label(locale, "Segnali", "Signals")}:\n${signalText}`,
    {
      x: 0.5,
      y: 2.8,
      w: 9,
      h: 2.5,
      fontSize: 10,
      fontFace: theme.fonts.body,
      color: hexToRgb(theme.colors.text),
      transparency: 30,
      valign: "top",
    }
  );
}

function addFormatPieSlide(
  pptx: PptxGenJS,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(
    label(locale, "Distribuzione Formati", "Format Distribution"),
    {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 24,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.primary),
      bold: true,
    }
  );

  const chartData = [
    {
      name: label(locale, "Formati", "Formats"),
      labels: ["Image", "Video", "Carousel"],
      values: [brand.imageCount, brand.videoCount, brand.carouselCount],
    },
  ];

  slide.addChart(pptx.ChartType.pie, chartData, {
    x: 1.5,
    y: 1.2,
    w: 7,
    h: 4,
    showLegend: true,
    legendPos: "b",
    legendFontSize: 11,
    legendColor: hexToRgb(theme.colors.text),
    showPercent: true,
    dataLabelFontSize: 11,
    dataLabelColor: hexToRgb(theme.colors.text),
    chartColors: [
      hexToRgb(theme.colors.primary),
      hexToRgb(theme.colors.secondary),
      hexToRgb(theme.colors.accent),
    ],
  });
}

function addCtaBarSlide(
  pptx: PptxGenJS,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(label(locale, "Top CTA", "Top CTAs"), {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: 24,
    fontFace: theme.fonts.heading,
    color: hexToRgb(theme.colors.primary),
    bold: true,
  });

  const ctas = brand.topCtas.slice(0, 8);
  if (ctas.length === 0) {
    slide.addText(label(locale, "Nessun dato CTA", "No CTA data"), {
      x: 0.5,
      y: 2.5,
      w: 9,
      h: 0.5,
      fontSize: 14,
      fontFace: theme.fonts.body,
      color: hexToRgb(theme.colors.text),
      transparency: 40,
    });
    return;
  }

  const chartData = [
    {
      name: "CTA",
      labels: ctas.map((c) => c.name),
      values: ctas.map((c) => c.count),
    },
  ];

  slide.addChart(pptx.ChartType.bar, chartData, {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 4,
    barDir: "bar",
    showLegend: false,
    catAxisLabelColor: hexToRgb(theme.colors.text),
    catAxisLabelFontSize: 10,
    valAxisLabelColor: hexToRgb(theme.colors.text),
    valAxisLabelFontSize: 10,
    chartColors: [hexToRgb(theme.colors.primary)],
  });
}

function addPlatformPieSlide(
  pptx: PptxGenJS,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(
    label(locale, "Distribuzione Piattaforme", "Platform Distribution"),
    {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 24,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.primary),
      bold: true,
    }
  );

  const plats = brand.platforms;
  if (plats.length === 0) {
    slide.addText(label(locale, "Nessun dato piattaforma", "No platform data"), {
      x: 0.5,
      y: 2.5,
      w: 9,
      h: 0.5,
      fontSize: 14,
      fontFace: theme.fonts.body,
      color: hexToRgb(theme.colors.text),
      transparency: 40,
    });
    return;
  }

  const chartData = [
    {
      name: label(locale, "Piattaforme", "Platforms"),
      labels: plats.map((p) => p.name),
      values: plats.map((p) => p.count),
    },
  ];

  const palette = [
    hexToRgb(theme.colors.primary),
    hexToRgb(theme.colors.secondary),
    hexToRgb(theme.colors.accent),
    "8a6bb0",
    "5ba09b",
    "a06b5b",
  ];

  slide.addChart(pptx.ChartType.pie, chartData, {
    x: 1.5,
    y: 1.2,
    w: 7,
    h: 4,
    showLegend: true,
    legendPos: "b",
    legendFontSize: 11,
    legendColor: hexToRgb(theme.colors.text),
    showPercent: true,
    dataLabelFontSize: 11,
    dataLabelColor: hexToRgb(theme.colors.text),
    chartColors: palette.slice(0, plats.length),
  });
}

function addStatsSlide(
  pptx: PptxGenJS,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(
    label(locale, "Durata Campagna & Lunghezza Copy", "Campaign Duration & Copy Length"),
    {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 24,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.primary),
      bold: true,
    }
  );

  const stats: [string, string][] = [
    [
      label(locale, "Durata media campagna", "Avg. campaign duration"),
      brand.avgDuration > 0
        ? `${brand.avgDuration} ${label(locale, "giorni", "days")}`
        : "—",
    ],
    [
      label(locale, "Lunghezza media copy", "Avg. copy length"),
      brand.avgCopyLength > 0
        ? `${brand.avgCopyLength} ${label(locale, "caratteri", "chars")}`
        : "—",
    ],
    [
      label(locale, "Refresh rate (90gg)", "Refresh rate (90d)"),
      brand.adsPerWeek > 0
        ? `${brand.adsPerWeek} ${label(locale, "ads/settimana", "ads/week")}`
        : "—",
    ],
  ];

  stats.forEach(([lbl, val], i) => {
    const y = 1.4 + i * 1.2;

    slide.addText(lbl, {
      x: 0.5,
      y,
      w: 9,
      h: 0.4,
      fontSize: 13,
      fontFace: theme.fonts.body,
      color: hexToRgb(theme.colors.text),
      transparency: 30,
    });

    slide.addText(val, {
      x: 0.5,
      y: y + 0.35,
      w: 9,
      h: 0.5,
      fontSize: 28,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.primary),
      bold: true,
    });
  });
}

function addLatestAdsSlide(
  pptx: PptxGenJS,
  brand: BrandData,
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(label(locale, "Ultime Ads", "Latest Ads"), {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: 24,
    fontFace: theme.fonts.heading,
    color: hexToRgb(theme.colors.primary),
    bold: true,
  });

  const ads = brand.latestAds.slice(0, 6);
  if (ads.length === 0) {
    slide.addText(label(locale, "Nessuna ad recente", "No recent ads"), {
      x: 0.5,
      y: 2.5,
      w: 9,
      h: 0.5,
      fontSize: 14,
      fontFace: theme.fonts.body,
      color: hexToRgb(theme.colors.text),
      transparency: 40,
    });
    return;
  }

  const cols = 3;
  const cardW = 2.7;
  const cardH = 0.5;

  ads.forEach((ad, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.5 + col * (cardW + 0.3);
    const y = 1.2 + row * (cardH + 0.3);

    const headline = ad.headline ?? `Ad #${ad.ad_archive_id.slice(0, 8)}`;

    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: "1A1A1A" },
      rectRadius: 0.05,
      line: { color: hexToRgb(theme.colors.primary), width: 0.5 },
    });

    slide.addText(headline, {
      x: x + 0.1,
      y,
      w: cardW - 0.2,
      h: cardH,
      fontSize: 9,
      fontFace: theme.fonts.body,
      color: hexToRgb(theme.colors.text),
      valign: "middle",
    });
  });
}

function addClosingSlide(
  pptx: PptxGenJS,
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  if (theme.logoBase64 && theme.logoMimeType) {
    slide.addImage({
      data: `data:${theme.logoMimeType};base64,${theme.logoBase64}`,
      x: 3.75,
      y: 1.0,
      w: 2.5,
      h: 2.5,
      sizing: { type: "contain", w: 2.5, h: 2.5 },
    });
  }

  slide.addText(label(locale, "Grazie.", "Thank you."), {
    x: 0.5,
    y: 3.6,
    w: 9,
    h: 0.8,
    fontSize: 28,
    fontFace: theme.fonts.heading,
    color: hexToRgb(theme.colors.primary),
    bold: true,
    align: "center",
  });

  slide.addText("Powered by MAIT \u00B7 NIMA Digital", {
    x: 0.5,
    y: 4.5,
    w: 9,
    h: 0.4,
    fontSize: 10,
    fontFace: theme.fonts.body,
    color: hexToRgb(theme.colors.text),
    transparency: 50,
    align: "center",
  });
}

// ─── Comparison slide builders ───────────────────────────────────

function addComparisonCoverSlide(
  pptx: PptxGenJS,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  if (theme.logoBase64 && theme.logoMimeType) {
    slide.addImage({
      data: `data:${theme.logoMimeType};base64,${theme.logoBase64}`,
      x: 0.5,
      y: 0.4,
      w: 1.5,
      h: 1.5,
      sizing: { type: "contain", w: 1.5, h: 1.5 },
    });
  }

  const brandNames = brands.map((b) => b.name).join(" vs ");
  slide.addText(brandNames, {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 1.2,
    fontSize: 30,
    fontFace: theme.fonts.heading,
    color: hexToRgb(theme.colors.primary),
    bold: true,
  });

  slide.addText(
    label(locale, "Report Confronto Brand", "Brand Comparison Report"),
    {
      x: 0.5,
      y: 3.3,
      w: 9,
      h: 0.6,
      fontSize: 18,
      fontFace: theme.fonts.body,
      color: hexToRgb(theme.colors.text),
    }
  );

  slide.addText(formatDate(locale), {
    x: 0.5,
    y: 4.0,
    w: 9,
    h: 0.4,
    fontSize: 12,
    fontFace: theme.fonts.body,
    color: hexToRgb(theme.colors.text),
    transparency: 40,
  });

  slide.addText("Powered by MAIT", {
    x: 0.5,
    y: 4.8,
    w: 9,
    h: 0.3,
    fontSize: 10,
    fontFace: theme.fonts.body,
    color: hexToRgb(theme.colors.primary),
    transparency: 50,
  });
}

function addComparisonOverviewSlide(
  pptx: PptxGenJS,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(label(locale, "Panoramica Comparativa", "Comparative Overview"), {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: 24,
    fontFace: theme.fonts.heading,
    color: hexToRgb(theme.colors.primary),
    bold: true,
  });

  const headerRow: PptxGenJS.TableRow = [
    {
      text: "",
      options: {
        fontSize: 11,
        fontFace: theme.fonts.heading,
        color: hexToRgb(theme.colors.text),
        fill: { color: "1A1A1A" },
        bold: true,
        border: { type: "none" as const },
      },
    },
    ...brands.map((b) => ({
      text: b.name,
      options: {
        fontSize: 11,
        fontFace: theme.fonts.heading,
        color: hexToRgb(theme.colors.primary),
        fill: { color: "1A1A1A" },
        bold: true,
        align: "center" as const,
        border: { type: "none" as const },
      },
    })),
  ];

  const metrics: [string, (b: BrandData) => string][] = [
    [label(locale, "Ads totali", "Total ads"), (b) => String(b.totalAds)],
    [label(locale, "Ads attive", "Active ads"), (b) => String(b.activeAds)],
    [label(locale, "Durata media", "Avg. duration"), (b) => b.avgDuration > 0 ? `${b.avgDuration}d` : "—"],
    [label(locale, "Lungh. copy", "Copy length"), (b) => b.avgCopyLength > 0 ? `${b.avgCopyLength}` : "—"],
    [label(locale, "Refresh rate", "Refresh rate"), (b) => b.adsPerWeek > 0 ? `${b.adsPerWeek}/wk` : "—"],
  ];

  const dataRows: PptxGenJS.TableRow[] = metrics.map(([lbl, fn]) => [
    {
      text: lbl,
      options: {
        fontSize: 10,
        fontFace: theme.fonts.body,
        color: hexToRgb(theme.colors.text),
        fill: { color: hexToRgb(theme.colors.background) },
        border: { type: "none" as const },
        transparency: 20,
      },
    },
    ...brands.map((b) => ({
      text: fn(b),
      options: {
        fontSize: 10,
        fontFace: theme.fonts.body,
        color: hexToRgb(theme.colors.text),
        fill: { color: hexToRgb(theme.colors.background) },
        align: "center" as const,
        border: { type: "none" as const },
      },
    })),
  ]);

  const colW =
    brands.length === 2
      ? [3, 3, 3]
      : [2.5, 2.17, 2.17, 2.17];

  slide.addTable([headerRow, ...dataRows], {
    x: 0.5,
    y: 1.2,
    w: 9,
    colW,
    rowH: 0.5,
  });
}

function addComparisonObjectivesSlide(
  pptx: PptxGenJS,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(
    label(locale, "Obiettivi Campagna (stimati)", "Campaign Objectives (estimated)"),
    {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 24,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.primary),
      bold: true,
    }
  );

  const colWidth = 9 / brands.length;

  brands.forEach((b, i) => {
    const x = 0.5 + i * colWidth;
    const obj = b.objectiveInference;

    slide.addText(b.name, {
      x,
      y: 1.2,
      w: colWidth - 0.2,
      h: 0.4,
      fontSize: 12,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.primary),
      bold: true,
    });

    slide.addText(obj.objective.replace(/_/g, " ").toUpperCase(), {
      x,
      y: 1.7,
      w: colWidth - 0.2,
      h: 0.4,
      fontSize: 14,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.text),
      bold: true,
    });

    // Confidence bar bg
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y: 2.2,
      w: colWidth - 0.3,
      h: 0.2,
      fill: { color: "333333" },
      line: { type: "none" },
    });

    // Confidence bar fill
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y: 2.2,
      w: (colWidth - 0.3) * (obj.confidence / 100),
      h: 0.2,
      fill: { color: hexToRgb(theme.colors.primary) },
      line: { type: "none" },
    });

    slide.addText(`${obj.confidence}%`, {
      x,
      y: 2.5,
      w: colWidth - 0.2,
      h: 0.3,
      fontSize: 10,
      fontFace: theme.fonts.body,
      color: hexToRgb(theme.colors.text),
      transparency: 40,
    });
  });
}

function addComparisonFormatSlide(
  pptx: PptxGenJS,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(
    label(locale, "Distribuzione Formati", "Format Distribution"),
    {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 24,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.primary),
      bold: true,
    }
  );

  const chartData = [
    {
      name: "Image",
      labels: brands.map((b) => b.name),
      values: brands.map((b) => b.imageCount),
    },
    {
      name: "Video",
      labels: brands.map((b) => b.name),
      values: brands.map((b) => b.videoCount),
    },
    {
      name: "Carousel",
      labels: brands.map((b) => b.name),
      values: brands.map((b) => b.carouselCount),
    },
  ];

  slide.addChart(pptx.ChartType.bar, chartData, {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 4,
    barDir: "col",
    barGrouping: "clustered",
    showLegend: true,
    legendPos: "b",
    legendFontSize: 11,
    legendColor: hexToRgb(theme.colors.text),
    catAxisLabelColor: hexToRgb(theme.colors.text),
    catAxisLabelFontSize: 10,
    valAxisLabelColor: hexToRgb(theme.colors.text),
    valAxisLabelFontSize: 10,
    chartColors: [
      hexToRgb(theme.colors.primary),
      hexToRgb(theme.colors.secondary),
      hexToRgb(theme.colors.accent),
    ],
  });
}

function addComparisonCtaSlide(
  pptx: PptxGenJS,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(label(locale, "Top CTA per Brand", "Top CTAs per Brand"), {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: 24,
    fontFace: theme.fonts.heading,
    color: hexToRgb(theme.colors.primary),
    bold: true,
  });

  const colWidth = 9 / brands.length;

  brands.forEach((b, i) => {
    const x = 0.5 + i * colWidth;

    slide.addText(b.name, {
      x,
      y: 1.2,
      w: colWidth - 0.2,
      h: 0.4,
      fontSize: 12,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.primary),
      bold: true,
    });

    b.topCtas.slice(0, 5).forEach((cta, j) => {
      slide.addText(`${cta.name} (${cta.count})`, {
        x,
        y: 1.8 + j * 0.4,
        w: colWidth - 0.2,
        h: 0.35,
        fontSize: 10,
        fontFace: theme.fonts.body,
        color: hexToRgb(theme.colors.text),
      });
    });
  });
}

function addComparisonRefreshSlide(
  pptx: PptxGenJS,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(
    label(locale, "Refresh Rate (90 giorni)", "Refresh Rate (90 days)"),
    {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 24,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.primary),
      bold: true,
    }
  );

  const chartData = [
    {
      name: label(locale, "Ads/settimana", "Ads/week"),
      labels: brands.map((b) => b.name),
      values: brands.map((b) => b.adsPerWeek),
    },
  ];

  slide.addChart(pptx.ChartType.bar, chartData, {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 4,
    barDir: "bar",
    showLegend: false,
    catAxisLabelColor: hexToRgb(theme.colors.text),
    catAxisLabelFontSize: 11,
    valAxisLabelColor: hexToRgb(theme.colors.text),
    valAxisLabelFontSize: 10,
    chartColors: [hexToRgb(theme.colors.primary)],
  });
}

function addComparisonLatestAdsSlide(
  pptx: PptxGenJS,
  brands: BrandData[],
  theme: ThemeConfig,
  locale: Locale
) {
  const slide = pptx.addSlide();
  slide.background = { color: hexToRgb(theme.colors.background) };

  slide.addText(label(locale, "Ultime Ads per Brand", "Latest Ads per Brand"), {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: 24,
    fontFace: theme.fonts.heading,
    color: hexToRgb(theme.colors.primary),
    bold: true,
  });

  const colWidth = 9 / brands.length;

  brands.forEach((b, i) => {
    const x = 0.5 + i * colWidth;

    slide.addText(b.name, {
      x,
      y: 1.2,
      w: colWidth - 0.2,
      h: 0.4,
      fontSize: 12,
      fontFace: theme.fonts.heading,
      color: hexToRgb(theme.colors.primary),
      bold: true,
    });

    b.latestAds.slice(0, 4).forEach((ad, j) => {
      const headline = ad.headline ?? `Ad #${ad.ad_archive_id.slice(0, 8)}`;
      const y = 1.8 + j * 0.5;

      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: colWidth - 0.3,
        h: 0.4,
        fill: { color: "1A1A1A" },
        rectRadius: 0.03,
        line: { color: hexToRgb(theme.colors.primary), width: 0.5 },
      });

      slide.addText(headline, {
        x: x + 0.05,
        y,
        w: colWidth - 0.4,
        h: 0.4,
        fontSize: 8,
        fontFace: theme.fonts.body,
        color: hexToRgb(theme.colors.text),
        valign: "middle",
      });
    });
  });
}

// ─── Main entry points ──────────────────────────────────────────

export async function generateSinglePptx(
  brand: BrandData,
  theme?: ThemeConfig | null,
  locale: Locale = "it"
): Promise<Buffer> {
  const t = theme ?? DEFAULT_THEME;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pptx.author = "MAIT \u00B7 NIMA Digital";
  pptx.title = `${brand.name} \u2014 Report`;

  addCoverSlide(pptx, brand, t, locale);
  addOverviewSlide(pptx, brand, t, locale);
  addObjectiveSlide(pptx, brand, t, locale);
  addFormatPieSlide(pptx, brand, t, locale);
  addCtaBarSlide(pptx, brand, t, locale);
  addPlatformPieSlide(pptx, brand, t, locale);
  addStatsSlide(pptx, brand, t, locale);
  addLatestAdsSlide(pptx, brand, t, locale);
  addClosingSlide(pptx, t, locale);

  const output = await pptx.write({ outputType: "nodebuffer" });
  return output as Buffer;
}

export async function generateComparisonPptx(
  brands: BrandData[],
  theme?: ThemeConfig | null,
  locale: Locale = "it"
): Promise<Buffer> {
  const t = theme ?? DEFAULT_THEME;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "MAIT \u00B7 NIMA Digital";
  pptx.title = `${brands.map((b) => b.name).join(" vs ")} \u2014 Comparison Report`;

  addComparisonCoverSlide(pptx, brands, t, locale);
  addComparisonOverviewSlide(pptx, brands, t, locale);
  addComparisonObjectivesSlide(pptx, brands, t, locale);
  addComparisonFormatSlide(pptx, brands, t, locale);
  addComparisonCtaSlide(pptx, brands, t, locale);
  addComparisonRefreshSlide(pptx, brands, t, locale);
  addComparisonLatestAdsSlide(pptx, brands, t, locale);
  addClosingSlide(pptx, t, locale);

  const output = await pptx.write({ outputType: "nodebuffer" });
  return output as Buffer;
}
