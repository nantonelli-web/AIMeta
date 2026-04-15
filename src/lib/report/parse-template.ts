import JSZip from "jszip";

/**
 * Theme configuration extracted from a PPTX template file.
 * Stored as JSONB in mait_client_templates.theme_config.
 */
export interface ThemeConfig {
  colors: {
    primary: string;      // accent1 hex
    secondary: string;    // accent2 hex
    background: string;   // dk1 or extracted bg
    text: string;         // lt1
    accent: string;       // accent3
  };
  fonts: {
    heading: string;
    body: string;
  };
  logoBase64: string | null;
  logoMimeType: string | null;
}

/** NIMA default theme — used when no template is provided */
export const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: "#D4A843",
    secondary: "#5b7ea3",
    background: "#0A0A0A",
    text: "#F5F5F5",
    accent: "#6b8e6b",
  },
  fonts: {
    heading: "Arial",
    body: "Arial",
  },
  logoBase64: null,
  logoMimeType: null,
};

/**
 * Extract a 6-hex-digit sRGB color value from theme XML.
 * Looks for `<a:srgbClr val="RRGGBB"/>` inside the given XML element string.
 * Returns "#RRGGBB" or the fallback.
 */
function extractSrgbColor(xml: string, tag: string, fallback: string): string {
  // e.g. <a:dk1><a:srgbClr val="000000"/></a:dk1>
  const tagPattern = new RegExp(
    `<a:${tag}>[\\s\\S]*?<a:srgbClr\\s+val="([A-Fa-f0-9]{6})"`,
    "i"
  );
  const match = xml.match(tagPattern);
  if (match) return `#${match[1].toUpperCase()}`;

  // Some themes use sysClr instead
  const sysPattern = new RegExp(
    `<a:${tag}>[\\s\\S]*?<a:sysClr[^>]+lastClr="([A-Fa-f0-9]{6})"`,
    "i"
  );
  const sysMatch = xml.match(sysPattern);
  if (sysMatch) return `#${sysMatch[1].toUpperCase()}`;

  return fallback;
}

/**
 * Extract font name from theme XML for major or minor font.
 */
function extractFont(xml: string, type: "majorFont" | "minorFont", fallback: string): string {
  const pattern = new RegExp(
    `<a:${type}>[\\s\\S]*?<a:latin\\s+typeface="([^"]+)"`,
    "i"
  );
  const match = xml.match(pattern);
  return match ? match[1] : fallback;
}

/**
 * Parse an uploaded PPTX file to extract branding configuration.
 *
 * 1. Unzips the PPTX
 * 2. Reads ppt/theme/theme1.xml for color scheme & fonts
 * 3. Reads ppt/media/ to find the first logo image
 * 4. Returns a ThemeConfig object
 */
export async function parseTemplate(buffer: ArrayBuffer): Promise<ThemeConfig> {
  try {
    const zip = await JSZip.loadAsync(buffer);

    // ── 1. Parse theme XML ─────────────────────────────────────
    let themeXml = "";
    const themeFile = zip.file("ppt/theme/theme1.xml");
    if (themeFile) {
      themeXml = await themeFile.async("text");
    }

    let colors = { ...DEFAULT_THEME.colors };
    let fonts = { ...DEFAULT_THEME.fonts };

    if (themeXml) {
      colors = {
        primary: extractSrgbColor(themeXml, "accent1", DEFAULT_THEME.colors.primary),
        secondary: extractSrgbColor(themeXml, "accent2", DEFAULT_THEME.colors.secondary),
        background: extractSrgbColor(themeXml, "dk1", DEFAULT_THEME.colors.background),
        text: extractSrgbColor(themeXml, "lt1", DEFAULT_THEME.colors.text),
        accent: extractSrgbColor(themeXml, "accent3", DEFAULT_THEME.colors.accent),
      };
      fonts = {
        heading: extractFont(themeXml, "majorFont", DEFAULT_THEME.fonts.heading),
        body: extractFont(themeXml, "minorFont", DEFAULT_THEME.fonts.body),
      };
    }

    // ── 2. Extract logo from media ────────────────────────────
    let logoBase64: string | null = null;
    let logoMimeType: string | null = null;

    const mediaFiles = Object.keys(zip.files)
      .filter(
        (name) =>
          name.startsWith("ppt/media/") &&
          /\.(png|jpg|jpeg|gif)$/i.test(name)
      )
      .sort(); // deterministic order

    if (mediaFiles.length > 0) {
      const imgFile = zip.file(mediaFiles[0]);
      if (imgFile) {
        const imgData = await imgFile.async("base64");
        logoBase64 = imgData;
        const ext = mediaFiles[0].split(".").pop()?.toLowerCase() ?? "png";
        logoMimeType =
          ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "gif"
              ? "image/gif"
              : "image/png";
      }
    }

    return { colors, fonts, logoBase64, logoMimeType };
  } catch (err) {
    console.warn("[parse-template] Failed to parse PPTX template, using defaults:", err);
    return { ...DEFAULT_THEME };
  }
}
