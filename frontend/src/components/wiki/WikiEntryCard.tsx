import Link from "next/link";

import { resolveApiAsset } from "@/lib/api";

import { WikiTagList } from "./WikiTagList";
import type { WikiCategory, WikiEntry } from "./types";
import { canOpenWikiEntry, isNewWikiEntry, visibilityLabel } from "./utils";

type WikiEntryCardProps = {
  entry: WikiEntry;
  category?: WikiCategory;
  isGm?: boolean;
};

export function WikiEntryCard({ entry, category, isGm = false }: WikiEntryCardProps) {
  const openable = canOpenWikiEntry(entry, isGm);
  const containerClassName =
    "block overflow-hidden rounded-2xl border border-lumen-dark bg-lumen-bg transition hover:border-lumen-mid hover:bg-lumen-dark/10";

  const content = (
    <>
      <div className="aspect-[16/8] bg-lumen-dark/20">
        {entry.image_url ? (
          <img src={resolveApiAsset(entry.image_url)} alt={entry.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm uppercase tracking-[0.2em] text-slate-500">
            No image
          </div>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {category ? (
            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{category.name}</span>
          ) : null}
          <span className="rounded-full border border-lumen-dark px-2.5 py-1 text-[11px] uppercase tracking-[0.15em] text-slate-300">
            {visibilityLabel(entry.visibility_state)}
          </span>
          {isNewWikiEntry(entry.created_at) ? (
            <span className="rounded-full bg-lumen-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-black">
              NEW
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-slate-100">{entry.title}</h3>
          <p className="text-sm leading-6 text-slate-300">
            {entry.excerpt ?? (openable ? "No summary available." : "This record is not yet accessible.")}
          </p>
        </div>

        <WikiTagList tags={entry.tags} />

        {!openable ? (
          <p className="text-sm font-medium text-lumen-accent">Title discovered. Entry remains locked.</p>
        ) : null}
      </div>
    </>
  );

  if (!openable) {
    return <div className={containerClassName}>{content}</div>;
  }

  return (
    <Link href={`/wiki/${entry.id}`} className={containerClassName}>
      {content}
    </Link>
  );
}
