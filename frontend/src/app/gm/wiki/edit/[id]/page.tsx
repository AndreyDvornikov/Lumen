"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { WikiArticle } from "@/components/wiki/WikiArticle";
import { WikiEditor } from "@/components/wiki/editor/WikiEditor";
import type { AuthUser, WikiCategory, WikiEntry, WikiVisibilityState } from "@/components/wiki/types";
import { slugifyWikiTitle, visibilityLabel } from "@/components/wiki/utils";
import { apiFetch } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

type EntryFormState = {
  title: string;
  slug: string;
  category_id: string;
  image_url: string;
  tags: string;
  content: string;
  visibility_state: WikiVisibilityState;
};

const DEFAULT_ENTRY_FORM: EntryFormState = {
  title: "",
  slug: "",
  category_id: "",
  image_url: "",
  tags: "",
  content: "",
  visibility_state: "hidden",
};

const VISIBILITY_OPTIONS: WikiVisibilityState[] = ["hidden", "title_only", "partial", "full"];

export default function GmWikiEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNewEntry = params.id === "new";

  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [entryId, setEntryId] = useState<number | null>(isNewEntry ? null : Number(params.id));
  const [form, setForm] = useState<EntryFormState>(DEFAULT_ENTRY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

      const [categoryData, entryList] = await Promise.all([
        apiFetch<WikiCategory[]>("/gm/wiki/categories"),
        apiFetch<WikiEntry[]>("/gm/wiki/entries"),
      ]);

      setCategories(categoryData);
      setEntries(entryList);

      if (isNewEntry) {
        setForm((current) => ({
          ...current,
          category_id: current.category_id || String(categoryData[0]?.id ?? ""),
        }));
      } else {
        const entry = await apiFetch<WikiEntry>(`/wiki/entries/${params.id}`);
        setEntryId(entry.id);
        setForm({
          title: entry.title,
          slug: entry.slug,
          category_id: String(entry.category_id),
          image_url: entry.image_url ?? "",
          tags: entry.tags.join(", "),
          content: entry.content ?? "",
          visibility_state: entry.visibility_state,
        });
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        logout();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load wiki editor");
    } finally {
      setLoading(false);
    }
  }, [isNewEntry, params.id, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void loadData();
  }, [loadData, router]);

  async function saveEntry(overrides: Partial<{ is_published: boolean }> = {}) {
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title,
      slug: form.slug || slugifyWikiTitle(form.title),
      category_id: Number(form.category_id),
      image_url: form.image_url || null,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      content: form.content,
      visibility_state: form.visibility_state,
      ...overrides,
    };

    try {
      if (entryId === null) {
        const created = await apiFetch<WikiEntry>("/gm/wiki/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            is_published: overrides.is_published ?? false,
            is_unlocked: false,
          }),
        });
        router.replace(`/gm/wiki/edit/${created.id}`);
        return;
      }

      await apiFetch<WikiEntry>(`/gm/wiki/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save article");
    } finally {
      setSaving(false);
    }
  }

  async function unlockEntry() {
    if (entryId === null) {
      return;
    }

    try {
      await apiFetch<WikiEntry>(`/gm/wiki/entries/${entryId}/unlock`, { method: "PATCH" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock article");
    }
  }

  async function deleteEntry() {
    if (entryId === null) {
      router.replace("/gm/wiki");
      return;
    }

    try {
      await apiFetch(`/gm/wiki/entries/${entryId}`, { method: "DELETE" });
      router.replace("/gm/wiki");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete article");
    }
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((current) => ({ ...current, image_url: result }));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  const titleToIdMap = useMemo(
    () => new Map(entries.map((entry) => [entry.title.toLowerCase(), entry.id])),
    [entries]
  );

  const previewEntry: WikiEntry = {
    id: entryId ?? 0,
    category_id: Number(form.category_id) || 0,
    title: form.title || "Untitled Entry",
    slug: form.slug || slugifyWikiTitle(form.title),
    image_url: form.image_url || null,
    excerpt: null,
    content: form.content,
    is_published: false,
    is_unlocked: false,
    visibility_state: form.visibility_state,
    tags: form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    linked_entry_ids: [],
    linked_entries: [],
    created_at: new Date().toISOString(),
  };

  if (loading) {
    return <main className="mx-auto max-w-6xl px-6 py-8 text-slate-300">Loading editor...</main>;
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/gm/wiki" className="text-sm text-slate-300 transition hover:text-lumen-accent">
          Back to GM wiki
        </Link>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5 rounded-2xl border border-lumen-dark bg-lumen-bg p-6">
          <h1 className="text-2xl font-semibold text-slate-100">{entryId ? "Edit Article" : "Create Article"}</h1>

          <input
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                title: event.target.value,
                slug: current.slug || slugifyWikiTitle(event.target.value),
              }))
            }
            placeholder="Title"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />

          <input
            value={form.slug}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            placeholder="Slug"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />

          <select
            value={form.category_id}
            onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <div className="space-y-3">
            <input
              value={form.image_url}
              onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))}
              placeholder="Cover image URL"
              className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
            />
            <label className="inline-flex cursor-pointer rounded-xl border border-lumen-dark px-4 py-2 text-sm text-slate-200 transition hover:border-lumen-mid">
              Upload cover image
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>

          <input
            value={form.tags}
            onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
            placeholder="Tags separated by commas"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />

          <select
            value={form.visibility_state}
            onChange={(event) =>
              setForm((current) => ({
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

          <WikiEditor value={form.content} onChange={(value) => setForm((current) => ({ ...current, content: value }))} />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveEntry()}
              className="rounded-xl bg-lumen-mid px-4 py-2 font-semibold text-white transition hover:bg-lumen-accent disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveEntry({ is_published: true })}
              className="rounded-xl border border-lumen-mid px-4 py-2 font-semibold text-lumen-accent transition hover:bg-lumen-dark/20 disabled:opacity-60"
            >
              Publish
            </button>
            <button
              type="button"
              disabled={saving || entryId === null}
              onClick={() => void unlockEntry()}
              className="rounded-xl border border-lumen-dark px-4 py-2 text-slate-200 transition hover:border-lumen-mid disabled:opacity-60"
            >
              Unlock
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void deleteEntry()}
              className="rounded-xl border border-rose-900 px-4 py-2 text-rose-300 transition hover:bg-rose-950/40 disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">Preview</h2>
          <WikiArticle
            entry={previewEntry}
            canViewHiddenContent
            resolveArticleId={(title) => titleToIdMap.get(title.toLowerCase()) ?? null}
          />
        </div>
      </section>
    </main>
  );
}
