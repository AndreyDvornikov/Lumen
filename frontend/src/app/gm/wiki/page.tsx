"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { AuthUser, WikiCategory, WikiEntry, WikiVisibilityState } from "@/components/wiki/types";
import { slugifyWikiTitle, visibilityLabel } from "@/components/wiki/utils";
import { apiFetch } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

type CategoryFormState = {
  name: string;
  slug: string;
  image_url: string;
  description: string;
};

type ArticleFormState = {
  title: string;
  slug: string;
  content: string;
  category_id: string;
  image_url: string;
  visibility_state: WikiVisibilityState;
};

const DEFAULT_CATEGORY_FORM: CategoryFormState = {
  name: "",
  slug: "",
  image_url: "",
  description: "",
};

const DEFAULT_ARTICLE_FORM: ArticleFormState = {
  title: "",
  slug: "",
  content: "",
  category_id: "",
  image_url: "",
  visibility_state: "hidden",
};

const VISIBILITY_OPTIONS: WikiVisibilityState[] = ["hidden", "title_only", "partial", "full"];

export default function GmWikiPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [newCategory, setNewCategory] = useState(DEFAULT_CATEGORY_FORM);
  const [newArticle, setNewArticle] = useState(DEFAULT_ARTICLE_FORM);
  const [isArticleSlugEdited, setIsArticleSlugEdited] = useState(false);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<number, CategoryFormState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const user = await apiFetch<AuthUser>("/auth/me");
      if (user.role !== "gm") {
        router.replace("/wiki");
        return;
      }
      setCurrentUser(user);

      const [categoryData, entryData] = await Promise.all([
        apiFetch<WikiCategory[]>("/gm/wiki/categories"),
        apiFetch<WikiEntry[]>("/gm/wiki/entries"),
      ]);

      setCategories(categoryData);
      setEntries(entryData);
      setCategoryDrafts(
        Object.fromEntries(
          categoryData.map((category) => [
            category.id,
            {
              name: category.name,
              slug: category.slug,
              image_url: category.image_url ?? "",
              description: category.description ?? "",
            },
          ])
        )
      );
      setNewArticle((current) => ({
        ...current,
        category_id: current.category_id || String(categoryData[0]?.id ?? ""),
      }));
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        logout();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load GM wiki panel");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void loadData();
  }, [loadData, router]);

  const sortedEntries = useMemo(() => [...entries].sort((a, b) => b.id - a.id), [entries]);

  async function createCategory() {
    try {
      await apiFetch<WikiCategory>("/gm/wiki/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategory.name,
          slug: newCategory.slug || slugifyWikiTitle(newCategory.name),
          image_url: newCategory.image_url || null,
          description: newCategory.description || null,
        }),
      });
      setNewCategory(DEFAULT_CATEGORY_FORM);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    }
  }

  async function saveCategory(categoryId: number) {
    const draft = categoryDrafts[categoryId];
    if (!draft) {
      return;
    }

    try {
      await apiFetch<WikiCategory>(`/gm/wiki/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          slug: draft.slug || slugifyWikiTitle(draft.name),
          image_url: draft.image_url || null,
          description: draft.description || null,
        }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category");
    }
  }

  async function createArticle() {
    try {
      if (!newArticle.title.trim()) {
        setError("Title is required");
        return;
      }

      if (!newArticle.category_id) {
        setError("Select category");
        return;
      }

      const payload = {
        category_id: Number(newArticle.category_id),
        title: newArticle.title.trim(),
        slug: newArticle.slug || slugifyWikiTitle(newArticle.title) || "article",
        image_url: newArticle.image_url || null,
        content: newArticle.content?.trim() || " ",
        is_published: false,
        is_unlocked: false,
        visibility_state: newArticle.visibility_state,
        tags: [],
      };

      const created = await apiFetch<WikiEntry>("/gm/wiki/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setNewArticle(DEFAULT_ARTICLE_FORM);
      setIsArticleSlugEdited(false);
      router.push(`/gm/wiki/edit/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create article");
    }
  }

  async function unlockEntry(entryId: number) {
    try {
      await apiFetch<WikiEntry>(`/gm/wiki/entries/${entryId}/unlock`, { method: "PATCH" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock article");
    }
  }

  async function deleteEntry(entryId: number) {
    try {
      await apiFetch(`/gm/wiki/entries/${entryId}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete article");
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-6 py-8 text-slate-300">Loading GM wiki panel...</main>;
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-lumen-accent">GM Panel</p>
        <h1 className="text-3xl font-semibold text-slate-100">Wiki Management</h1>
        <p className="text-sm text-slate-300">
          {currentUser ? `Signed in as ${currentUser.username}` : "Manage categories, visibility and article content."}
        </p>
      </header>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
          <h2 className="text-xl font-semibold text-slate-100">Create Category</h2>
          <input
            value={newCategory.name}
            onChange={(event) =>
              setNewCategory((current) => ({
                ...current,
                name: event.target.value,
                slug: current.slug || slugifyWikiTitle(event.target.value),
              }))
            }
            placeholder="Category name"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <input
            value={newCategory.slug}
            onChange={(event) => setNewCategory((current) => ({ ...current, slug: event.target.value }))}
            placeholder="Slug"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <input
            value={newCategory.image_url}
            onChange={(event) => setNewCategory((current) => ({ ...current, image_url: event.target.value }))}
            placeholder="Image URL"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <textarea
            value={newCategory.description}
            onChange={(event) => setNewCategory((current) => ({ ...current, description: event.target.value }))}
            placeholder="Description"
            rows={4}
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <button
            type="button"
            onClick={createCategory}
            className="rounded-xl bg-lumen-mid px-4 py-2 font-semibold text-white transition hover:bg-lumen-accent"
          >
            Create Category
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
          <h2 className="text-xl font-semibold text-slate-100">Create Article</h2>
          <input
            value={newArticle.title}
            onChange={(event) =>
              setNewArticle((current) => ({
                ...current,
                title: event.target.value,
                slug: isArticleSlugEdited ? current.slug : slugifyWikiTitle(event.target.value),
              }))
            }
            placeholder="Article title"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <input
            value={newArticle.slug}
            onChange={(event) => {
              setIsArticleSlugEdited(true);
              setNewArticle((current) => ({ ...current, slug: event.target.value }));
            }}
            placeholder="Slug"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <select
            value={newArticle.category_id}
            onChange={(event) => setNewArticle((current) => ({ ...current, category_id: event.target.value }))}
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            value={newArticle.image_url}
            onChange={(event) => setNewArticle((current) => ({ ...current, image_url: event.target.value }))}
            placeholder="Cover image URL"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <select
            value={newArticle.visibility_state}
            onChange={(event) =>
              setNewArticle((current) => ({
                ...current,
                visibility_state: event.target.value as WikiVisibilityState,
              }))
            }
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {visibilityLabel(option)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={createArticle}
            className="rounded-xl bg-lumen-mid px-4 py-2 font-semibold text-white transition hover:bg-lumen-accent"
          >
            Create Article
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-100">Categories</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {categories.map((category) => {
            const draft = categoryDrafts[category.id];
            if (!draft) {
              return null;
            }

            return (
              <div key={category.id} className="space-y-3 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setCategoryDrafts((current) => ({
                      ...current,
                      [category.id]: { ...current[category.id], name: event.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                />
                <input
                  value={draft.slug}
                  onChange={(event) =>
                    setCategoryDrafts((current) => ({
                      ...current,
                      [category.id]: { ...current[category.id], slug: event.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                />
                <input
                  value={draft.image_url}
                  onChange={(event) =>
                    setCategoryDrafts((current) => ({
                      ...current,
                      [category.id]: { ...current[category.id], image_url: event.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                />
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setCategoryDrafts((current) => ({
                      ...current,
                      [category.id]: { ...current[category.id], description: event.target.value },
                    }))
                  }
                  rows={4}
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                />
                <button
                  type="button"
                  onClick={() => saveCategory(category.id)}
                  className="rounded-xl border border-lumen-mid px-4 py-2 text-sm font-semibold text-lumen-accent transition hover:bg-lumen-dark/20"
                >
                  Save Category
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-100">Articles</h2>
        <div className="grid gap-4">
          {sortedEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-5 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-100">{entry.title}</p>
                <p className="text-sm text-slate-400">
                  {categories.find((category) => category.id === entry.category_id)?.name ?? "Unknown category"} ·{" "}
                  {visibilityLabel(entry.visibility_state)}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/gm/wiki/edit/${entry.id}`}
                  className="rounded-xl border border-lumen-mid px-4 py-2 text-sm font-semibold text-lumen-accent transition hover:bg-lumen-dark/20"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => unlockEntry(entry.id)}
                  className="rounded-xl border border-lumen-dark px-4 py-2 text-sm text-slate-200 transition hover:border-lumen-mid"
                >
                  Unlock
                </button>
                <button
                  type="button"
                  onClick={() => void deleteEntry(entry.id)}
                  className="rounded-xl border border-rose-900 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-950/40"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
