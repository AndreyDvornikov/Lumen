"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { WikiCategoryGrid } from "@/components/wiki/WikiCategoryGrid";
import { WikiEntryCard } from "@/components/wiki/WikiEntryCard";
import { WikiSearch } from "@/components/wiki/WikiSearch";
import type { AuthUser, WikiCategory, WikiEntry } from "@/components/wiki/types";
import { apiFetch, resolveWebSocketUrl } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

export default function WikiPage() {
  const router = useRouter();

  const [checkedAuth, setCheckedAuth] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [query, setQuery] = useState("");
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

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category])),
    [categories]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [categoryData, entryData] = await Promise.all([
        apiFetch<WikiCategory[]>("/wiki/categories", { withAuth: true }),
        apiFetch<WikiEntry[]>("/wiki/entries", { withAuth: true }),
      ]);

      setCategories(categoryData);
      setEntries(entryData);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        logout();
        router.replace("/login");
        return;
      }

      setError(err instanceof Error ? err.message : "Failed to load wiki data");
    } finally {
      setLoading(false);
    }
  }, [router]);

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
      void loadData();
    }

    return () => {
      cancelled = true;
    };
  }, [checkedAuth, loadData, router]);

  useEffect(() => {
    if (!checkedAuth) return;

    const socket = new WebSocket(resolveWebSocketUrl("/ws/campaign/wiki"));

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { event?: string };

        if (
          payload.event === "wiki_entry_unlocked" ||
          payload.event === "wiki_entry_created" ||
          payload.event === "wiki_entry_updated"
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
  }, [checkedAuth, loadData]);

  const filteredEntries = entries.filter((entry) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;

    return (
      entry.title.toLowerCase().includes(normalizedQuery) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    );
  });

  // ⛔ пока проверяем токен — ничего не рендерим
  if (!checkedAuth) return null;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="space-y-2 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-lumen-accent">Campaign Archive</p>
        <h1 className="text-3xl font-semibold text-lumen-accent">Wiki</h1>
        <p className="text-sm text-slate-300">Browse the discovered records of the campaign.</p>

        {currentUser?.role === "gm" && (
          <Link
            href="/gm/wiki"
            className="inline-flex rounded-lg border border-lumen-mid px-4 py-2 text-sm text-lumen-accent transition hover:bg-lumen-dark/20"
          >
            Open GM Panel
          </Link>
        )}
      </header>

      <section className="rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <WikiSearch query={query} onQueryChange={setQuery} />
      </section>

      {loading && <p className="text-sm text-slate-300">Loading wiki entries...</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!loading && !error && (
        <>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-100">Categories</h2>
            <WikiCategoryGrid categories={categories} />
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-100">Articles</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredEntries.map((entry) => (
                <WikiEntryCard
                  key={entry.id}
                  entry={entry}
                  category={categoryById[entry.category_id]}
                  isGm={currentUser?.role === "gm"}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}