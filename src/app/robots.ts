import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/brands", "/library", "/collections", "/benchmarks", "/report", "/alerts", "/settings", "/credits", "/api/"],
      },
    ],
    sitemap: "https://aiscan.biz/sitemap.xml",
  };
}
