import Link from "next/link";
import { Fragment, ReactNode } from "react";

import { resolveApiAsset } from "@/lib/api";

import { WikiTagList } from "./WikiTagList";
import type { WikiEntry } from "./types";
import { isNewWikiEntry } from "./utils";

type WikiArticleProps = {
  entry: WikiEntry;
  canViewHiddenContent?: boolean;
  resolveArticleId?: (title: string) => number | null;
};

function renderInlineContent(content: string, resolveArticleId?: (title: string) => number | null): ReactNode[] {
  const pattern = /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = content.split(pattern).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const title = part.slice(2, -2).trim();
      const linkedId = resolveArticleId?.(title) ?? null;
      if (linkedId) {
        return (
          <Link key={`${part}-${index}`} href={`/wiki/${linkedId}`} className="text-lumen-accent underline underline-offset-4">
            {title}
          </Link>
        );
      }
      return (
        <span key={`${part}-${index}`} className="text-lumen-accent">
          {title}
        </span>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={`${part}-${index}`} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function renderWikiBlocks(
  content: string,
  canViewHiddenContent: boolean,
  resolveArticleId?: (title: string) => number | null
): ReactNode[] {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim() === ":::hidden") {
      index += 1;
      const hiddenLines: string[] = [];
      while (index < lines.length && lines[index].trim() !== ":::") {
        hiddenLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && lines[index].trim() === ":::") {
        index += 1;
      }

      if (canViewHiddenContent) {
        blocks.push(
          <div key={`hidden-${index}`} className="rounded-2xl border border-lumen-mid/50 bg-lumen-dark/15 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-lumen-accent">Hidden Segment</p>
            <div className="space-y-4">{renderWikiBlocks(hiddenLines.join("\n"), true, resolveArticleId)}</div>
          </div>
        );
      } else {
        blocks.push(
          <div key={`hidden-${index}`} className="rounded-2xl border border-dashed border-lumen-mid/50 bg-black/20 p-4 text-sm text-slate-400">
            Classified section remains hidden.
          </div>
        );
      }
      continue;
    }

    const imageMatch = line.match(/^!\[(.*?)\]\((.+)\)$/);
    if (imageMatch) {
      blocks.push(
        <figure key={`image-${index}`} className="overflow-hidden rounded-2xl border border-lumen-dark bg-lumen-bg">
          <img src={resolveApiAsset(imageMatch[2])} alt={imageMatch[1] || "Wiki image"} className="w-full object-cover" />
          {imageMatch[1] ? <figcaption className="px-4 py-3 text-sm text-slate-400">{imageMatch[1]}</figcaption> : null}
        </figure>
      );
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={`h1-${index}`} className="text-3xl font-semibold text-slate-100">
          {renderInlineContent(line.slice(2), resolveArticleId)}
        </h2>
      );
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={`h2-${index}`} className="text-2xl font-semibold text-slate-100">
          {renderInlineContent(line.slice(3), resolveArticleId)}
        </h3>
      );
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={`h3-${index}`} className="text-xl font-semibold text-slate-100">
          {renderInlineContent(line.slice(4), resolveArticleId)}
        </h4>
      );
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push(
        <ul key={`list-${index}`} className="list-disc space-y-2 pl-6 text-slate-200">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInlineContent(item, resolveArticleId)}</li>
          ))}
        </ul>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    const paragraph = paragraphLines.join("\n");
    blocks.push(
      <p key={`paragraph-${index}`} className="whitespace-pre-line leading-7 text-slate-200">
        {renderInlineContent(paragraph, resolveArticleId)}
      </p>
    );
  }

  return blocks;
}

export function WikiArticle({ entry, canViewHiddenContent = false, resolveArticleId }: WikiArticleProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-lumen-dark bg-lumen-bg">
      {entry.image_url ? (
        <div className="max-h-[420px] overflow-hidden border-b border-lumen-dark">
          <img src={resolveApiAsset(entry.image_url)} alt={entry.title} className="h-full w-full object-cover" />
        </div>
      ) : null}

      <div className="space-y-6 p-6 sm:p-8">
        <header className="space-y-4 border-b border-lumen-dark pb-6">
          <div className="flex flex-wrap items-center gap-2">
            {isNewWikiEntry(entry.created_at) ? (
              <span className="rounded-full bg-lumen-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-black">
                NEW
              </span>
            ) : null}
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Wiki Entry</span>
          </div>
          <h1 className="text-3xl font-semibold text-slate-100">{entry.title}</h1>
          <WikiTagList tags={entry.tags} />
        </header>

        <div className="space-y-4">{renderWikiBlocks(entry.content ?? "", canViewHiddenContent, resolveArticleId)}</div>

        {entry.linked_entries.length > 0 ? (
          <section className="space-y-3 border-t border-lumen-dark pt-6">
            <h2 className="text-lg font-semibold text-slate-100">Linked Articles</h2>
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
        ) : null}
      </div>
    </article>
  );
}
