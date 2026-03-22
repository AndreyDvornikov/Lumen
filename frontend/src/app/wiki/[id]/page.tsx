"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { WikiArticle } from "@/components/wiki/WikiArticle";
import type { AuthUser, WikiEntry } from "@/components/wiki/types";
import { apiFetch, resolveWebSocketUrl } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

export default function WikiEntryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const entryId = Number(params.id);

  const [checkedAuth, setCheckedAuth] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [entry, setEntry] = useState<WikiEntry | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔐 AUTH GUARD
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
    } else {
      setCheckedAuth(true);
    }
  }, [router]);

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
        apiFetch<WikiEntry>(`/wiki/entries/${entryId}`, { withAuth: true }),
        apiFetch<WikiEntry[]>("/wiki/entries", { withAuth: true }),
      ]);

      setEntry(entryData);
      setEntries(listData);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        logout();
        router.replace("/login");
        return;
      }

      setError(err instanceof Error ? err.message : "Failed to load wiki entry");
    } finally {
      setLoading(false);
    }
  }, [entryId, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const user = await apiFetch<AuthUser>("/auth/me", { withAuth: true });
        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch (err) {
        if (!cancelled && err instanceof Error && err.message.includes("401")) {
          logout();
          router.replace("/login");
        }
      }
    }

    if (checkedAuth) {
      void loadCurrentUser();
      void loadEntry();
    }

    return () => {
      cancelled = true;
    };
  }, [checkedAuth, loadEntry, router]);

  useEffect(() => {
    if (!checkedAuth) return;

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
  }, [checkedAuth, entryId, loadEntry]);

  const titleToIdMap = useMemo(
    () => new Map(entries.map((e) => [e.title.toLowerCase(), e.id])),
    [entries]
  );

  if (!checkedAuth) return null;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Link href="/wiki" className="text-sm text-slate-300 hover:text-lumen-accent">
          Back to wiki
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-300">Loading article...</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!loading && !error && entry && (
        <WikiArticle
          entry={entry}
          canViewHiddenContent={currentUser?.role === "gm"}
          resolveArticleId={(title) => titleToIdMap.get(title.toLowerCase()) ?? null}
        />
      )}
    </main>
  );
}