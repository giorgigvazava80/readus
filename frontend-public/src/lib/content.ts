import type { ContentCategory, ContentStatus } from "@/lib/types";

export const CONTENT_CATEGORY_LABELS: Record<ContentCategory, string> = {
  books: "წიგნები",
  chapters: "თავები",
  poems: "Poems",
  stories: "მოთხრობები",
};

export const CONTENT_STATUS_STYLES: Record<ContentStatus, string> = {
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700",
};

export function htmlToPlainText(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function toExcerpt(html: string | undefined, fallback = "მიმოხილვა არ არის ხელმისაწვდომი."): string {
  const plain = htmlToPlainText(html);
  if (!plain) {
    return fallback;
  }
  if (plain.length <= 180) {
    return plain;
  }
  return `${plain.slice(0, 177)}...`;
}

export function estimateReadTimeFromHtml(
  value: string | undefined,
  template = "{minutes} წთ კითხვის დრო",
): string {
  const plain = htmlToPlainText(value);
  const words = plain.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return template.replace("{minutes}", String(minutes));
}




