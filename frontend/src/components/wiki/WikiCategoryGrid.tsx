import Link from "next/link";

import { resolveApiAsset } from "@/lib/api";

import type { WikiCategory } from "./types";

type WikiCategoryGridProps = {
  categories: WikiCategory[];
};

export function WikiCategoryGrid({ categories }: WikiCategoryGridProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-lumen-dark bg-lumen-bg p-6 text-sm text-slate-300">
        No categories available yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/wiki/category/${category.id}`}
          className="overflow-hidden rounded-2xl border border-lumen-dark bg-lumen-bg transition hover:border-lumen-mid hover:bg-lumen-dark/10"
        >
          <div className="aspect-[16/8] bg-lumen-dark/20">
            {category.image_url ? (
              <img
                src={resolveApiAsset(category.image_url)}
                alt={category.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm uppercase tracking-[0.2em] text-slate-500">
                No image
              </div>
            )}
          </div>
          <div className="space-y-2 p-5">
            <h3 className="text-xl font-semibold text-slate-100">{category.name}</h3>
            <p className="text-sm leading-6 text-slate-300">{category.description ?? "No description yet."}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
