import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * After the user picks a "From" date in a range, hand focus to the
 * paired "To" input and pop its calendar open — so they don't have
 * to find and click the second field themselves.
 *
 * Deferred to the next tick because the browser is still mid-dismiss
 * on the From popup; calling showPicker() synchronously inside the
 * change handler races with that animation and Chrome quietly drops
 * the request. focus() alone is the safe fallback when showPicker()
 * throws (Safari pre-16.4, lost user activation, etc).
 */
export function jumpToDateInput(el: HTMLInputElement | null): void {
  if (!el) return;
  setTimeout(() => {
    try {
      el.focus();
      el.showPicker?.();
    } catch {
      // showPicker can throw without a fresh user activation — the
      // focus() above already moved the cursor, which is enough.
    }
  }, 0);
}
