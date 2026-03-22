"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { WikiEntryCard } from "@/components/wiki/WikiEntryCard";
import { WikiSearch } from "@/components/wiki/WikiSearch";
import type { AuthUser, WikiCategory, WikiEntry } from "@/components/wiki/types";
import { apiFetch, resolveWebSocketUrl } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

export default function WikiCategoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const categoryId = Number(params.id);

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

      setError(err instanceof Error ? err.message : "Failed to load wiki category");
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
  }, [checkedAuth, categoryId, loadData]);

  const currentCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId]
  );

  const filteredEntries = entries.filter((entry) => {
    if (entry.category_id !== categoryId) return false;

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;

    return (
      entry.title.toLowerCase().includes(normalizedQuery) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    );
  });

  // ⛔ пока не проверили auth — ничего не рендерим
  if (!checkedAuth) return null;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Link href="/wiki" className="text-sm text-slate-300 hover:text-lumen-accent">
          Back to wiki
        </Link>
      </div>

      <header className="space-y-2 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-lumen-accent">Category</p>
        <h1 className="text-3xl font-semibold text-slate-100">
          {currentCategory?.name ?? "Wiki Category"}
        </h1>
        <p className="text-sm text-slate-300">
          {currentCategory?.description ?? "Loading category details..."}
        </p>
      </header>

      <section className="rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <WikiSearch query={query} onQueryChange={setQuery} label="Search in category" />
      </section>

      {loading && <p className="text-sm text-slate-300">Loading category entries...</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!loading && !error && (
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
      )}
    </main>
  );
}