"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import type { MaitScrapeJob } from "@/types";

const statusBadge: Record<
  MaitScrapeJob["status"],
  { variant: "default" | "muted" | "gold"; icon: React.ReactNode }
> = {
  succeeded: {
    variant: "gold",
    icon: <CheckCircle2 className="size-3" />,
  },
  failed: {
    variant: "muted",
    icon: <XCircle className="size-3 text-red-400" />,
  },
  running: {
    variant: "muted",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  pending: {
    variant: "muted",
    icon: <Loader2 className="size-3" />,
  },
};

function formatRelative(d: string | null) {
  if (!d) return "—";
  const diffMs = Date.now() - new Date(d).getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return `${Math.round(diffH * 60)}m fa`;
  if (diffH < 24) return `${Math.round(diffH)}h fa`;
  return `${Math.round(diffH / 24)}g fa`;
}

export function JobHistory({ jobs }: { jobs: MaitScrapeJob[] }) {
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(jobId: string, deleteAds: boolean) {
    setDeleting(true);
    const t = toast.loading("Eliminazione in corso…");
    try {
      const res = await fetch(
        `/api/scrape-jobs/${jobId}?deleteAds=${deleteAds}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Errore" }));
        toast.error(json.error, { id: t });
      } else {
        toast.success(
          deleteAds
            ? "Scan e ads relativi eliminati."
            : "Scan eliminato (ads mantenute).",
          { id: t }
        );
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore", { id: t });
    } finally {
      setDeleting(false);
      setConfirmId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Cronologia scan</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {jobs.map((j) => {
            const cfg = statusBadge[j.status];
            const isConfirming = confirmId === j.id;
            return (
              <div key={j.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant={cfg.variant} className="gap-1">
                      {cfg.icon}
                      {j.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      {formatRelative(j.started_at)}
                    </span>
                    {j.error && (
                      <span className="text-xs text-red-400 truncate max-w-xs">
                        {j.error}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{j.records_count} ads</span>
                    {j.cost_cu > 0 && <span>${j.cost_cu.toFixed(3)}</span>}
                    <button
                      onClick={() => setConfirmId(isConfirming ? null : j.id)}
                      disabled={deleting}
                      className="size-7 rounded-md border border-border hover:bg-muted hover:border-red-400/40 grid place-items-center text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                      aria-label="Elimina scan"
                      title="Elimina scan"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {isConfirming && (
                  <div className="mt-3 p-3 rounded-md border border-border bg-muted/50 space-y-2">
                    <p className="text-xs text-foreground">
                      Vuoi eliminare anche le <b>{j.records_count} ads</b>{" "}
                      raccolte da questo scan?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleting}
                        onClick={() => handleDelete(j.id, true)}
                      >
                        Elimina scan + ads
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deleting}
                        onClick={() => handleDelete(j.id, false)}
                      >
                        Solo lo scan
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deleting}
                        onClick={() => setConfirmId(null)}
                      >
                        Annulla
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
