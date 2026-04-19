"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HistoryEntry {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  created_at: string;
  user_name: string;
  user_email: string;
}

interface UserOption {
  id: string;
  label: string;
}

export function CreditManager({
  history: initialHistory,
  userOptions,
}: {
  history: HistoryEntry[];
  userOptions: UserOption[];
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(initialHistory);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedUserId) {
      toast.error("Select a user");
      return;
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount === 0) {
      toast.error("Enter a valid non-zero amount");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          amount: numAmount,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        toast.error(data.error || "Failed to adjust credits");
        setLoading(false);
        return;
      }

      toast.success("Credits adjusted successfully");

      // Add new entry to history at the top
      const selectedUser = userOptions.find((u) => u.id === selectedUserId);
      const newEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        user_id: selectedUserId,
        amount: numAmount,
        reason: reason.trim(),
        created_at: new Date().toISOString(),
        user_name: selectedUser?.label.split(" (")[0] ?? "—",
        user_email:
          selectedUser?.label.match(/\((.+)\)/)?.[1] ?? "—",
      };
      setHistory((prev) => [newEntry, ...prev].slice(0, 50));

      setAmount("");
      setReason("");
      setSelectedUserId("");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <>
      {/* Manual adjustment form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Coins className="size-4 text-gold" />
            Manual Credit Adjustment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1.5 min-w-[220px] flex-1">
              <Label className="text-xs">User</Label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-muted px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <option value="">Select a user...</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                placeholder="+10 or -5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <Label className="text-xs">Reason</Label>
              <Input
                placeholder="e.g. Promo bonus"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Applying..." : "Apply"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* History table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Credit History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No credit history yet
            </p>
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {/* Header */}
              <div className="grid grid-cols-[1fr_1.2fr_auto_1fr_auto] gap-4 px-4 py-2 text-xs text-muted-foreground font-medium">
                <span>User</span>
                <span>Email</span>
                <span className="text-right w-20">Amount</span>
                <span>Reason</span>
                <span className="text-right w-36">Date</span>
              </div>
              {/* Rows */}
              {history.map((h) => (
                <div
                  key={h.id}
                  className="grid grid-cols-[1fr_1.2fr_auto_1fr_auto] gap-4 px-4 py-2.5 text-sm items-center"
                >
                  <span className="truncate font-medium">{h.user_name}</span>
                  <span className="truncate text-muted-foreground">
                    {h.user_email}
                  </span>
                  <span
                    className={`text-right w-20 font-medium ${
                      h.amount > 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {h.amount > 0 ? "+" : ""}
                    {h.amount}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {h.reason}
                  </span>
                  <span className="text-right w-36 text-xs text-muted-foreground">
                    {formatDate(h.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
