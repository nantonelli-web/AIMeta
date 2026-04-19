"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Search, Coins, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  workspace_id: string | null;
  workspace_name: string;
  credits_balance: number;
  created_at: string;
}

export function UserManagement({ users }: { users: User[] }) {
  const [search, setSearch] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [userList, setUserList] = useState(users);

  const filtered = userList.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.name ?? "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  async function handleCreditSubmit(userId: string) {
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
        body: JSON.stringify({ userId, amount: numAmount, reason: reason.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        toast.error(data.error || "Failed to adjust credits");
        setLoading(false);
        return;
      }

      toast.success(
        `Credits ${numAmount > 0 ? "added" : "removed"} successfully`
      );

      // Update the local user list with new balance
      setUserList((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, credits_balance: data.newBalance ?? u.credits_balance + numAmount }
            : u
        )
      );

      setEditingUserId(null);
      setAmount("");
      setReason("");
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
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm">
          {userList.length} users
        </CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border divide-y divide-border">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1.5fr_0.6fr_1fr_0.6fr_0.8fr_auto] gap-3 px-4 py-2 text-xs text-muted-foreground font-medium">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Workspace</span>
            <span className="text-right">Credits</span>
            <span className="text-right">Joined</span>
            <span className="w-28" />
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No users found
            </div>
          ) : (
            filtered.map((user) => (
              <div key={user.id}>
                <div className="grid grid-cols-[1fr_1.5fr_0.6fr_1fr_0.6fr_0.8fr_auto] gap-3 px-4 py-2.5 text-sm items-center">
                  <span className="truncate font-medium">
                    {user.name || "—"}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {user.email}
                  </span>
                  <span>
                    <Badge variant={user.role === "admin" ? "gold" : "muted"}>
                      {user.role || "member"}
                    </Badge>
                  </span>
                  <span className="truncate text-muted-foreground">
                    {user.workspace_name}
                  </span>
                  <span className="text-right font-medium text-gold">
                    {user.credits_balance}
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {formatDate(user.created_at)}
                  </span>
                  <span className="w-28">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditingUserId(
                          editingUserId === user.id ? null : user.id
                        )
                      }
                    >
                      <Coins className="size-3" />
                      Credits
                    </Button>
                  </span>
                </div>

                {/* Inline credit form */}
                {editingUserId === user.id && (
                  <div className="px-4 py-3 bg-muted/50 border-t border-border">
                    <div className="flex items-end gap-3 max-w-xl">
                      <div className="space-y-1.5 flex-shrink-0">
                        <Label className="text-xs">Amount</Label>
                        <Input
                          type="number"
                          placeholder="+10 or -5"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-28"
                        />
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <Label className="text-xs">Reason</Label>
                        <Input
                          placeholder="e.g. Manual top-up"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={loading}
                        onClick={() => handleCreditSubmit(user.id)}
                      >
                        {loading ? "Saving..." : "Apply"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingUserId(null);
                          setAmount("");
                          setReason("");
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
