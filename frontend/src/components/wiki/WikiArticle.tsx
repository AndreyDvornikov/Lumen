"use client";
const token = localStorage.getItem("token");
import Link from "next/link";
import ReactMarkdown from "react-markdown";

import { resolveApiAsset } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { WikiTagList } from "./WikiTagList";
import type { WikiEntry } from "./types";
import { isNewWikiEntry } from "./utils";

type WikiArticleProps = {
  entry: WikiEntry;
  canViewHiddenContent?: boolean;
  resolveArticleId?: (title: string) => number | null;
};

// --- Wiki links [[text]]
function parseWikiLinks(text: string, resolveArticleId?: (title: string) => number | null) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);

  return parts.map((part, i) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const title = part.slice(2, -2).trim();
      const id = title ? resolveArticleId?.(title) ?? null : null;

      return id ? (
        <Link key={i} href={`/wiki/${id}`} className="text-lumen-accent underline">
          {title}
        </Link>
      ) : (
        <span key={i} className="text-lumen-accent">
          {title}
        </span>
      );
    }

    return part;
  });
}

// --- Spoiler ||text||
function parseSpoilers(text: string) {
  const parts = text.split(/(\|\|.*?\|\|)/g);

  return parts.map((part, i) => {
    if (part.startsWith("||") && part.endsWith("||")) {
      const content = part.slice(2, -2);

      return (
        <span
          key={i}
          className="bg-slate-700 text-transparent hover:text-white px-1 rounded cursor-pointer transition"
        >
          {content}
        </span>
      );
    }

    return part;
  });
}

export function WikiArticle({
  entry,
  canViewHiddenContent = false,
  resolveArticleId,
}: WikiArticleProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-lumen-dark bg-lumen-bg">
      {entry.image_url && (
        <div className="max-h-[420px] overflow-hidden border-b border-lumen-dark">
          <img
            src={resolveApiAsset(entry.image_url)}
            alt={entry.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="space-y-6 p-6 sm:p-8">
        <header className="space-y-4 border-b border-lumen-dark pb-6">
          <div className="flex flex-wrap items-center gap-2">
            {isNewWikiEntry(entry.created_at) && (
              <span className="rounded-full bg-lumen-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-black">
                NEW
              </span>
            )}
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Wiki Entry
            </span>
          </div>

          <h1 className="text-3xl font-semibold text-slate-100">
            {entry.title}
          </h1>

          <WikiTagList tags={entry.tags} />
        </header>

        {/* --- Markdown */}
        <div className="markdown space-y-4 text-slate-200">
          <ReactMarkdown
            components={{
              a: ({ href, children }) => (
                <a
                  href={href || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-lumen-accent underline"
                >
                  {children}
                </a>
              ),

              img: ({ src, alt }) => {
                if (!src) return null;

                // 🧠 1. Если это base64 — НЕ трогаем
                if (src.startsWith("data:")) {
                  return (
                    <img
                      src={src}
                      alt={alt || ""}
                      className="rounded-xl border border-lumen-dark"
                    />
                  );
                }

                // 🧠 2. Обычные картинки → через backend
                const token = getToken();

                const cleanSrc = src.replace(/^\/?protected-image\//, "");

                const url = resolveApiAsset(
                  `/protected-image/${cleanSrc}?token=${token}`
                );

                return (
                  <img
                    src={url}
                    alt={alt || ""}
                    className="rounded-xl border border-lumen-dark"
                  />
                );
              },

              p: ({ children }) => {
                return (
                  <p>
                    {Array.isArray(children)
                      ? children.map((child, i) => {
                          if (typeof child === "string") {
                            const spoilerParsed = parseSpoilers(child);

                            return spoilerParsed.map((part, j) => {
                              if (typeof part === "string") {
                                return (
                                  <span key={`${i}-${j}`}>
                                    {parseWikiLinks(part, resolveArticleId)}
                                  </span>
                                );
                              }

                              return <span key={`${i}-${j}`}>{part}</span>;
                            });
                          }

                          return <span key={i}>{child}</span>;
                        })
                      : children}
                  </p>
                );
              },
            }}
          >
            {entry.content ?? ""}
          </ReactMarkdown>
        </div>

        {entry.linked_entries.length > 0 && (
          <section className="space-y-3 border-t border-lumen-dark pt-6">
            <h2 className="text-lg font-semibold text-slate-100">
              Linked Articles
            </h2>

            <div className="flex flex-wrap gap-3">
              {entry.linked_entries.map((linkedEntry) => (
                <Link
                  key={linkedEntry.id}
                  href={`/wiki/${linkedEntry.id}`}
                  className="rounded-xl border border-lumen-dark px-4 py-2 text-sm text-slate-200 transition hover:border-lumen-mid hover:text-lumen-accent"
                >
                  {linkedEntry.title}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}