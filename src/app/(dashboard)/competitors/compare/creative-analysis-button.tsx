"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import { AnalysisReport } from "./analysis-report";
import type { CreativeAnalysisResult } from "@/lib/ai/creative-analysis";

export function CreativeAnalysisButton({
  competitorIds,
}: {
  competitorIds: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreativeAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();

  const disabled = competitorIds.length < 2;

  async function handleClick() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/creative-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ competitor_ids: competitorIds }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t("creativeAnalysis", "analysisFailed"));
        return;
      }

      const data: CreativeAnalysisResult = await res.json();
      setResult(data);
    } catch {
      setError(t("creativeAnalysis", "analysisFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          onClick={handleClick}
          disabled={disabled || loading}
          variant="outline"
          size="sm"
        >
          {loading
            ? t("creativeAnalysis", "analyzing")
            : t("creativeAnalysis", "launchAnalysis")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {loading && (
          <p className="text-xs text-muted-foreground">
            {t("creativeAnalysis", "analyzing")}
          </p>
        )}
      </div>

      {result && (
        <AnalysisReport result={result} onClose={() => setResult(null)} />
      )}
    </div>
  );
}
