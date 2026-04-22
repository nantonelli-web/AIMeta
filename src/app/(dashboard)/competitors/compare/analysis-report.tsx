"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import type { CreativeAnalysisResult } from "@/lib/ai/creative-analysis";

export function AnalysisReport({
  result,
  mode,
}: {
  result: CreativeAnalysisResult;
  mode: "copywriter" | "creativeDirector";
  onClose: () => void;
}) {
  const { t } = useT();

  if (mode === "copywriter") {
    if (!result.copywriterReport) {
      return <AgentFailed text={t("creativeAnalysis", "copywriterFailed")} />;
    }
    const report = result.copywriterReport;
    return (
      <div className="space-y-4">
        <div className={cn("grid gap-4", report.brandAnalyses.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3")}>
          {report.brandAnalyses.map((brand) => (
            <Card key={brand.brandName} className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gold">{brand.brandName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label={t("creativeAnalysis", "toneOfVoice")} value={brand.toneOfVoice} />
                <Field label={t("creativeAnalysis", "copyStyle")} value={brand.copyStyle} />
                {brand.emotionalTriggers?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      {t("creativeAnalysis", "emotionalTriggers")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {brand.emotionalTriggers.map((trigger) => (
                        <Badge key={trigger} variant="gold">{trigger}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Field label={t("creativeAnalysis", "ctaPatterns")} value={brand.ctaPatterns} />
                <Field label={t("creativeAnalysis", "strengths")} value={brand.strengths} highlight="positive" />
                <Field label={t("creativeAnalysis", "weaknesses")} value={brand.weaknesses} highlight="negative" />
              </CardContent>
            </Card>
          ))}
        </div>
        <HighlightCard label={t("creativeAnalysis", "comparison")} text={report.comparison} />
        <HighlightCard label={t("creativeAnalysis", "recommendations")} text={report.recommendations} />
      </div>
    );
  }

  // Creative Director
  if (!result.creativeDirectorReport) {
    return <AgentFailed text={t("creativeAnalysis", "creativeDirectorFailed")} />;
  }
  const report = result.creativeDirectorReport;
  return (
    <div className="space-y-4">
      <div className={cn("grid gap-4", report.brandAnalyses.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3")}>
        {report.brandAnalyses.map((brand) => (
          <Card key={brand.brandName} className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gold">{brand.brandName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label={t("creativeAnalysis", "visualStyle")} value={brand.visualStyle} />
              <Field label={t("creativeAnalysis", "colorPalette")} value={brand.colorPalette} />
              <Field label={t("creativeAnalysis", "photographyStyle")} value={brand.photographyStyle} />
              <Field label={t("creativeAnalysis", "brandConsistency")} value={brand.brandConsistency} />
              <Field label={t("creativeAnalysis", "formatPreferences")} value={brand.formatPreferences} />
              <Field label={t("creativeAnalysis", "strengths")} value={brand.strengths} highlight="positive" />
              <Field label={t("creativeAnalysis", "weaknesses")} value={brand.weaknesses} highlight="negative" />
            </CardContent>
          </Card>
        ))}
      </div>
      <HighlightCard label={t("creativeAnalysis", "comparison")} text={report.comparison} />
      <HighlightCard label={t("creativeAnalysis", "recommendations")} text={report.recommendations} />
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: "positive" | "negative" }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className={cn(
        "text-xs leading-relaxed",
        highlight === "positive" && "text-emerald-400",
        highlight === "negative" && "text-gold",
        !highlight && "text-foreground"
      )}>{value}</p>
    </div>
  );
}

function HighlightCard({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-lg border border-gold/20 bg-gold/5 p-4">
      <p className="text-[10px] uppercase tracking-wider text-gold mb-2">{label}</p>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  );
}

function AgentFailed({ text }: { text: string }) {
  return (
    <div className="py-16 text-center space-y-2">
      <AlertCircle className="size-8 text-muted-foreground/50 mx-auto" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
