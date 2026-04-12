"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/context";

export function ScanButton({ competitorId }: { competitorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const { t } = useT();

  async function doScan() {
    setLoading(true);
    setShowOptions(false);
    const toastId = toast.loading(t("scan", "scrapingInProgress"));
    try {
      const res = await fetch("/api/apify/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          competitor_id: competitorId,
          max_items: 200,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          active_status: status,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Scrape failed", { id: toastId });
      } else {
        toast.success(`${json.records} ${t("scan", "adsSynced")}`, {
          id: toastId,
        });
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error", {
        id: toastId,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex">
        <Button
          onClick={doScan}
          disabled={loading}
          className="rounded-r-none"
        >
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          {loading ? t("scan", "scanning") : t("scan", "scanNow")}
        </Button>
        <Button
          onClick={() => setShowOptions(!showOptions)}
          disabled={loading}
          className="rounded-l-none border-l border-gold-foreground/20 px-2"
        >
          <ChevronDown className="size-4" />
        </Button>
      </div>

      {showOptions && (
        <div className="absolute right-0 top-full mt-2 z-20 w-72 rounded-lg border border-border bg-card shadow-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <CalendarRange className="size-4 text-gold" />
            {t("scan", "scanOptions")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">{t("scan", "dateFrom")}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">{t("scan", "dateTo")}</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-xs h-8"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">{t("scan", "adStatus")}</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "ACTIVE" | "ALL")}
              className="flex h-8 w-full rounded-md border border-border bg-muted px-2 text-xs text-foreground"
            >
              <option value="ACTIVE">{t("scan", "activeOnly")}</option>
              <option value="ALL">{t("scan", "allAds")}</option>
            </select>
          </div>

          {(dateFrom || dateTo || status !== "ACTIVE") && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setStatus("ACTIVE");
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              {t("scan", "resetFilters")}
            </button>
          )}

          <Button onClick={doScan} disabled={loading} className="w-full" size="sm">
            <RefreshCw className={loading ? "size-3 animate-spin" : "size-3"} />
            {t("scan", "launchScan")}
          </Button>
        </div>
      )}
    </div>
  );
}
