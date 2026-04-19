import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/context";
import { getLocale } from "@/lib/i18n/server";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const SITE_URL = "https://aiscan.biz";

export const metadata: Metadata = {
  title: {
    default: "MAIT — Ads Intelligence Tool | aiscan.biz",
    template: "%s | MAIT",
  },
  description:
    "Monitor competitor ads on Meta, Google and Instagram. AI-powered analysis, brand comparison and professional reports.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "MAIT — Ads Intelligence Tool",
    description:
      "Monitor competitor ads on Meta, Google and Instagram. AI-powered analysis, brand comparison and professional reports.",
    url: SITE_URL,
    siteName: "MAIT",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "MAIT — Ads Intelligence Tool",
    description:
      "Monitor competitor ads on Meta, Google and Instagram. AI-powered analysis and professional reports.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <I18nProvider initialLocale={locale}>
          {children}
          <Toaster theme="dark" position="bottom-right" />
        </I18nProvider>
      </body>
    </html>
  );
}
