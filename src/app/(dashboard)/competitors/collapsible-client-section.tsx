"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CollapsibleClientSection({
  clientKey,
  clientName,
  clientColor,
  brandCount,
  children,
}: {
  clientKey: string;
  clientName: string;
  clientColor: string;
  brandCount: number;
  children: React.ReactNode;
}) {
  const storageKey = `brands-collapsed-${clientKey}`;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "1") setCollapsed(true);
    } catch {
      // localStorage disabled — fall back to default expanded
    }
  }, [storageKey]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 mb-3 w-full text-left cursor-pointer hover:opacity-90 transition-opacity"
      >
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            collapsed && "-rotate-90"
          )}
        />
        <div
          className="size-3 rounded-sm shrink-0"
          style={{ backgroundColor: clientColor }}
        />
        <h2 className="text-sm font-semibold">{clientName}</h2>
        <Badge variant="muted">{brandCount}</Badge>
      </button>
      {!collapsed && children}
    </div>
  );
}
