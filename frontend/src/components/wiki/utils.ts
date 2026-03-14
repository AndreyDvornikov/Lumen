import type { WikiEntry, WikiVisibilityState } from "./types";

const NEW_BADGE_WINDOW_DAYS = 14;

export function isNewWikiEntry(createdAt: string): boolean {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return false;
  }

  const ageMs = Date.now() - created.getTime();
  return ageMs <= NEW_BADGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function canOpenWikiEntry(entry: WikiEntry, isGm: boolean): boolean {
  if (isGm) {
    return true;
  }
  return entry.visibility_state !== "title_only" && entry.visibility_state !== "hidden";
}

export function visibilityLabel(visibilityState: WikiVisibilityState): string {
  switch (visibilityState) {
    case "hidden":
      return "Hidden";
    case "title_only":
      return "Title Only";
    case "partial":
      return "Partial";
    case "full":
      return "Full";
    default:
      return visibilityState;
  }
}

export function slugifyWikiTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
