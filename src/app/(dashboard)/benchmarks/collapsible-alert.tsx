"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "danger" | "warning";

const TONES: Record<Tone, { wrap: string; title: string; chevron: string }> = {
  danger: {
    wrap: "rounded-lg border border-red-200 bg-red-50",
    title: "text-red-700",
    chevron: "text-red-700",
  },
  warning: {
    wrap: "rounded-lg border border-gold/40 bg-gold/5",
    title: "text-gold",
    chevron: "text-gold",
  },
};

/**
 * Collapsible header for the Benchmarks alert cards. Default state
 * is OPEN — alerts are informational, the user should see them at
 * least once. Click the header to fold the body away. Choice is
 * persisted in sessionStorage under the supplied key so navigating
 * within the dashboard keeps the alert closed, but a new tab/session
 * surfaces it again.
 */
export function CollapsibleAlert({
  tone,
  title,
  summary,
  persistKey,
  children,
}: {
  tone: Tone;
  title: string;
  /** One-line summary shown next to the title when collapsed (counts,
   *  brand count, etc.). Optional. */
  summary?: string;
  /** Stable key for sessionStorage persistence. Use a distinct value
   *  per alert type so they collapse independently. */
  persistKey: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(true);
  // Hydrate from sessionStorage on mount only — server render always
  // starts with `open` so the alert appears in SSR.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(`alert:${persistKey}`);
    if (stored === "0") setOpen(false);
    else if (stored === "1") setOpen(true);
  }, [persistKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`alert:${persistKey}`, next ? "1" : "0");
    }
  }

  const tones = TONES[tone];
  return (
    <div className={tones.wrap + " print:break-inside-avoid"}>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left cursor-pointer print:cursor-default"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            tones.chevron,
            !open && "-rotate-90",
          )}
        />
        <span className={cn("text-xs font-semibold", tones.title)}>{title}</span>
        {!open && summary && (
          <span className="text-[11px] text-muted-foreground ml-2 truncate">
            {summary}
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-3 pt-0 -mt-1">{children}</div>}
    </div>
  );
}
