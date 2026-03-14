"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { WikiEntryCard } from "@/components/wiki/WikiEntryCard";
import { WikiSearch } from "@/components/wiki/WikiSearch";
import type { AuthUser, WikiCategory, WikiEntry } from "@/components/wiki/types";
import { apiFetch, resolveWebSocketUrl } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

export default function WikiCategoryPage() {
  const params = useParams<{ id: string }>();
  const categoryId = Number(params.id);

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [categoryData, entryData] = await Promise.all([
        apiFetch<WikiCategory[]>("/wiki/categories", { withAuth: Boolean(getToken()) }),
        apiFetch<WikiEntry[]>("/wiki/entries", { withAuth: Boolean(getToken()) }),
      ]);
      setCategories(categoryData);
      setEntries(entryData);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        logout();
        setCurrentUser(null);
      }
      setError(err instanceof Error ? err.message : "Failed to load wiki category");
    } finally {
      setLoading(false);
    }
  }, []);

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
    void loadData();

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    const socket = new WebSocket(resolveWebSocketUrl("/ws/campaign/wiki"));
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { event?: string; categoryId?: number };
        if (
          (payload.event === "wiki_entry_unlocked" ||
            payload.event === "wiki_entry_created" ||
            payload.event === "wiki_entry_updated") &&
          payload.categoryId === categoryId
        ) {
          void loadData();
        }
      } catch {
        return;
      }
    };

    return () => {
      socket.close();
    };
  }, [categoryId, loadData]);

  const currentCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId]
  );

  const filteredEntries = entries.filter((entry) => {
    if (entry.category_id !== categoryId) {
      return false;
    }
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return true;
    }
    return (
      entry.title.toLowerCase().includes(normalizedQuery) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    );
  });

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Link href="/wiki" className="text-sm text-slate-300 transition hover:text-lumen-accent">
          Back to wiki
        </Link>
      </div>

      <header className="space-y-2 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-lumen-accent">Category</p>
        <h1 className="text-3xl font-semibold text-slate-100">{currentCategory?.name ?? "Wiki Category"}</h1>
        <p className="text-sm text-slate-300">{currentCategory?.description ?? "Loading category details..."}</p>
      </header>

      <section className="rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <WikiSearch query={query} onQueryChange={setQuery} label="Search in category" />
      </section>

      {loading ? <p className="text-sm text-slate-300">Loading category entries...</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {!loading && !error ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredEntries.map((entry) => (
            <WikiEntryCard
              key={entry.id}
              entry={entry}
              category={currentCategory ?? undefined}
              isGm={currentUser?.role === "gm"}
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}
