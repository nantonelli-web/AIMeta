"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

const options = [
  { value: "manual", label: "Manuale" },
  { value: "daily", label: "Giornaliera" },
  { value: "weekly", label: "Settimanale" },
] as const;

export function FrequencySelector({
  competitorId,
  initial,
}: {
  competitorId: string;
  initial: "manual" | "daily" | "weekly";
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as typeof value;
    setValue(next);
    startTransition(async () => {
      const res = await fetch(`/api/competitors/${competitorId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frequency: next }),
      });
      if (!res.ok) {
        toast.error("Impossibile aggiornare la frequenza.");
        setValue(initial);
        return;
      }
      toast.success(
        next === "manual"
          ? "Schedule disattivato — solo scan manuali."
          : `Scraping ${next === "daily" ? "giornaliero" : "settimanale"} attivo.`
      );
      router.refresh();
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm rounded-md border border-border bg-card px-3 h-9 hover:border-gold/50 transition-colors">
      <Calendar className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground">Schedule:</span>
      <select
        value={value}
        onChange={onChange}
        disabled={pending}
        className="bg-transparent text-foreground outline-none cursor-pointer disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-card">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
