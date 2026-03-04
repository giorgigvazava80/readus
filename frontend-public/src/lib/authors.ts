import type { ContentItem } from "@/lib/types";

export const ANONYMOUS_AUTHOR_KEY = "anonymous";

export function resolveAuthorKey(item: Pick<ContentItem, "author_key" | "author_username" | "is_anonymous">): string {
  if (item.author_key?.trim()) {
    return item.author_key.trim();
  }
  if (item.is_anonymous) {
    return ANONYMOUS_AUTHOR_KEY;
  }
  if (item.author_username?.trim()) {
    return item.author_username.trim();
  }
  return ANONYMOUS_AUTHOR_KEY;
}

export function authorProfilePath(authorKey: string): string {
  return `/authors/${encodeURIComponent(authorKey)}`;
}
