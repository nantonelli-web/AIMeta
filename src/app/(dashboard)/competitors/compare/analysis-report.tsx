"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import type { CreativeAnalysisResult } from "@/lib/ai/creative-analysis";

type Tab = "copywriter" | "creativeDirector";

export function AnalysisReport({
  result,
  onClose,
}: {
  result: CreativeAnalysisResult;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>(
    result.copywriterReport ? "copywriter" : "creativeDirector"
  );
  const { t } = useT();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif tracking-tight">
            {t("creativeAnalysis", "title")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("creativeAnalysis", "subtitle")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("creativeAnalysis", "close")}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {result.copywriterReport && (
          <button
            onClick={() => setActiveTab("copywriter")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === "copywriter"
                ? "bg-gold text-gold-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {t("creativeAnalysis", "copywriterTitle")}
          </button>
        )}
        {result.creativeDirectorReport && (
          <button
            onClick={() => setActiveTab("creativeDirector")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === "creativeDirector"
                ? "bg-gold text-gold-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {t("creativeAnalysis", "creativeDirectorTitle")}
          </button>
        )}
      </div>

      {/* Copywriter Tab */}
      {activeTab === "copywriter" && result.copywriterReport && (
        <div className="space-y-4">
          {/* Brand cards */}
          <div
            className={cn(
              "grid gap-4",
              result.copywriterReport.brandAnalyses.length === 2
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1 md:grid-cols-3"
            )}
          >
            {result.copywriterReport.brandAnalyses.map((brand) => (
              <Card key={brand.brandName}>
                <CardHeader>
                  <CardTitle className="text-sm text-gold">
                    {brand.brandName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <AnalysisField
                    label={t("creativeAnalysis", "toneOfVoice")}
                    value={brand.toneOfVoice}
                  />
                  <AnalysisField
                    label={t("creativeAnalysis", "copyStyle")}
                    value={brand.copyStyle}
                  />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      {t("creativeAnalysis", "emotionalTriggers")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {brand.emotionalTriggers.map((trigger) => (
                        <Badge key={trigger} variant="gold">
                          {trigger}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <AnalysisField
                    label={t("creativeAnalysis", "ctaPatterns")}
                    value={brand.ctaPatterns}
                  />
                  <AnalysisField
                    label={t("creativeAnalysis", "strengths")}
                    value={brand.strengths}
                    highlight="positive"
                  />
                  <AnalysisField
                    label={t("creativeAnalysis", "weaknesses")}
                    value={brand.weaknesses}
                    highlight="negative"
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison */}
          <Card className="border-gold/20">
            <CardHeader>
              <CardTitle className="text-sm">
                {t("creativeAnalysis", "comparison")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {result.copywriterReport.comparison}
              </p>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card className="border-gold/20">
            <CardHeader>
              <CardTitle className="text-sm">
                {t("creativeAnalysis", "recommendations")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {result.copywriterReport.recommendations}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Creative Director Tab */}
      {activeTab === "creativeDirector" && result.creativeDirectorReport && (
        <div className="space-y-4">
          {/* Brand cards */}
          <div
            className={cn(
              "grid gap-4",
              result.creativeDirectorReport.brandAnalyses.length === 2
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1 md:grid-cols-3"
            )}
          >
            {result.creativeDirectorReport.brandAnalyses.map((brand) => (
              <Card key={brand.brandName}>
                <CardHeader>
                  <CardTitle className="text-sm text-gold">
                    {brand.brandName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <AnalysisField
                    label={t("creativeAnalysis", "visualStyle")}
                    value={brand.visualStyle}
                  />
                  <AnalysisField
                    label={t("creativeAnalysis", "colorPalette")}
                    value={brand.colorPalette}
                  />
                  <AnalysisField
                    label={t("creativeAnalysis", "photographyStyle")}
                    value={brand.photographyStyle}
                  />
                  <AnalysisField
                    label={t("creativeAnalysis", "brandConsistency")}
                    value={brand.brandConsistency}
                  />
                  <AnalysisField
                    label={t("creativeAnalysis", "formatPreferences")}
                    value={brand.formatPreferences}
                  />
                  <AnalysisField
                    label={t("creativeAnalysis", "strengths")}
                    value={brand.strengths}
                    highlight="positive"
                  />
                  <AnalysisField
                    label={t("creativeAnalysis", "weaknesses")}
                    value={brand.weaknesses}
                    highlight="negative"
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison */}
          <Card className="border-gold/20">
            <CardHeader>
              <CardTitle className="text-sm">
                {t("creativeAnalysis", "comparison")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {result.creativeDirectorReport.comparison}
              </p>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card className="border-gold/20">
            <CardHeader>
              <CardTitle className="text-sm">
                {t("creativeAnalysis", "recommendations")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {result.creativeDirectorReport.recommendations}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function AnalysisField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "positive" | "negative";
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </p>
      <p
        className={cn(
          "text-xs leading-relaxed",
          highlight === "positive" && "text-emerald-400",
          highlight === "negative" && "text-amber-400",
          !highlight && "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}
