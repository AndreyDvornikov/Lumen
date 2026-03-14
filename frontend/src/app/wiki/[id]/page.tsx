"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { WikiArticle } from "@/components/wiki/WikiArticle";
import type { AuthUser, WikiEntry } from "@/components/wiki/types";
import { apiFetch, resolveWebSocketUrl } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

export default function WikiEntryPage() {
  const params = useParams<{ id: string }>();
  const entryId = Number(params.id);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [entry, setEntry] = useState<WikiEntry | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEntry = useCallback(async () => {
    if (!Number.isFinite(entryId)) {
      setError("Invalid wiki entry id");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [entryData, listData] = await Promise.all([
        apiFetch<WikiEntry>(`/wiki/entries/${entryId}`, { withAuth: Boolean(getToken()) }),
        apiFetch<WikiEntry[]>("/wiki/entries", { withAuth: Boolean(getToken()) }),
      ]);
      setEntry(entryData);
      setEntries(listData);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        logout();
        setCurrentUser(null);
      }
      setError(err instanceof Error ? err.message : "Failed to load wiki entry");
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      if (!getToken()) {
        setCurrentUser(null);
        return;
      }

      try {
        const user = await apiFetch<AuthUser>("/auth/me");
        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch (err) {
        if (!cancelled && err instanceof Error && err.message.includes("401")) {
          logout();
          setCurrentUser(null);
        }
      }
    }

    void loadCurrentUser();
    void loadEntry();

    return () => {
      cancelled = true;
    };
  }, [loadEntry]);

  useEffect(() => {
    const socket = new WebSocket(resolveWebSocketUrl("/ws/campaign/wiki"));
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { event?: string; entryId?: number };
        if (
          (payload.event === "wiki_entry_unlocked" ||
            payload.event === "wiki_entry_created" ||
            payload.event === "wiki_entry_updated") &&
          payload.entryId === entryId
        ) {
          void loadEntry();
        }
      } catch {
        return;
      }
    };

    return () => {
      socket.close();
    };
  }, [entryId, loadEntry]);

  const titleToIdMap = useMemo(
    () => new Map(entries.map((visibleEntry) => [visibleEntry.title.toLowerCase(), visibleEntry.id])),
    [entries]
  );

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Link href="/wiki" className="text-sm text-slate-300 transition hover:text-lumen-accent">
          Back to wiki
        </Link>
      </div>

      {loading ? <p className="text-sm text-slate-300">Loading article...</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {!loading && !error && entry ? (
        <WikiArticle
          entry={entry}
          canViewHiddenContent={currentUser?.role === "gm"}
          resolveArticleId={(title) => titleToIdMap.get(title.toLowerCase()) ?? null}
        />
      ) : null}
    </main>
  );
}
