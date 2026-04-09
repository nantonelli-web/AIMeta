import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Cronologia scan</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {jobs.map((j) => {
            const cfg = statusBadge[j.status];
            return (
              <div
                key={j.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
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
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
