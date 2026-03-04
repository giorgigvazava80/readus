import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import WorkCard, { type PublicWorkCardItem } from "@/components/WorkCard";
import CategoryFilter, { type PublicBrowseCategory } from "@/components/CategoryFilter";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { resolveAuthorKey } from "@/lib/authors";
import { fetchContent, resolveMediaUrl } from "@/lib/api";
import type { ContentItem } from "@/lib/types";

const CATEGORY_COLOR_PALETTE: Record<"books" | "stories" | "poems", string[]> = {
  books: ["hsl(24, 60%, 55%)", "hsl(32, 50%, 48%)", "hsl(14, 55%, 52%)"],
  stories: ["hsl(215, 40%, 45%)", "hsl(228, 35%, 50%)", "hsl(200, 45%, 42%)"],
  poems: ["hsl(150, 25%, 45%)", "hsl(165, 30%, 40%)", "hsl(135, 20%, 50%)"],
};

function toExcerpt(item: ContentItem): string {
  const rawHtml = item.description || item.extracted_text || item.body || "";
  // Remove HTML tags using regex and clean up extra spaces
  const raw = rawHtml.replace(/<[^>]*>?/gm, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  if (!raw) return "";
  if (raw.length <= 190) return raw;
  return `${raw.slice(0, 187)}...`;
}

function estimateReadTime(item: ContentItem, readTimeTemplate: string): string {
  const text = [item.body, item.extracted_text, item.description].filter(Boolean).join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return readTimeTemplate.replace("{minutes}", String(minutes));
}

function colorFor(category: "books" | "stories" | "poems", id: number): string {
  const palette = CATEGORY_COLOR_PALETTE[category];
  return palette[id % palette.length];
}

function toCardItem(
  category: "books" | "stories" | "poems",
  item: ContentItem,
  locale: string,
  excerptFallback: string,
  readTimeTemplate: string,
): PublicWorkCardItem {
  const excerpt = toExcerpt(item) || excerptFallback;

  return {
    id: item.id,
    publicSlug: item.public_slug || String(item.id),
    category,
    title: item.title,
    author: item.author_name || item.author_username || "",
    authorKey: resolveAuthorKey(item),
    excerpt,
    coverColor: colorFor(category, item.id),
    coverImageUrl: resolveMediaUrl(item.cover_image),
    date: new Date(item.created_at).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    readTime: estimateReadTime(item, readTimeTemplate),
    createdAt: item.created_at,
    isHidden: item.is_hidden,
  };
}

const PublicBrowsePage = () => {
  const { t, language } = useI18n();
  const [category, setCategory] = useState<PublicBrowseCategory>("all");
  const [search, setSearch] = useState("");
  const locale = language === "ka" ? "ka-GE" : "en-US";
  const excerptFallback = t("home.excerptUnavailable", "Excerpt is not available yet.");
  const readTimeTemplate = t("home.readTime", "{minutes} min read");

  const worksQuery = useQuery({
    queryKey: ["public-browse", "all", language],
    queryFn: async () => {
      const [books, stories, poems] = await Promise.all([
        fetchContent("books", { status: "approved", page: 1 }),
        fetchContent("stories", { status: "approved", page: 1 }),
        fetchContent("poems", { status: "approved", page: 1 }),
      ]);

      return [
        ...books.results.map((item) => toCardItem("books", item, locale, excerptFallback, readTimeTemplate)),
        ...stories.results.map((item) => toCardItem("stories", item, locale, excerptFallback, readTimeTemplate)),
        ...poems.results.map((item) => toCardItem("poems", item, locale, excerptFallback, readTimeTemplate)),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  });

  const filtered = useMemo(() => {
    const works = worksQuery.data || [];
    return works.filter((item) => {
      const matchCategory = category === "all" || item.category === category;
      const text = `${item.title} ${item.author} ${item.excerpt}`.toLowerCase();
      const matchSearch = text.includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [worksQuery.data, category, search]);

  return (
    <div>
      {/* Hero header */}
      <div className="border-b border-border/30 bg-muted/20 py-10 md:py-14">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">
              {t("browse.title", "Library")}
            </h1>
            <p className="mt-2 font-ui text-base text-muted-foreground max-w-lg">
              {t("browse.subtitle", "Discover books, stories, and poetry from the community")}
            </p>

            {/* Search bar — big and prominent */}
            <div className="relative mt-6 w-full max-w-xl">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("browse.searchPlaceholder", "Search by title or author...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 pr-4 font-ui h-14 text-base rounded-xl bg-background border-border/60 focus:border-primary/40 shadow-sm transition-colors"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <CategoryFilter active={category} onChange={setCategory} />
            <span className="hidden sm:inline-flex items-center rounded-full px-3 py-1 text-xs font-ui font-medium text-muted-foreground border border-border/50 bg-muted/30">
              {worksQuery.isLoading ? "..." : t("browse.worksCount", "{count} {plural}").replace("{count}", String(filtered.length)).replace("{plural}", filtered.length === 1 ? t("browse.work", "work") : t("browse.works", "works"))}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 py-8 md:py-10">
        {/* Loading skeleton */}
        {worksQuery.isLoading ? (
          <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl border bg-card shadow-card overflow-hidden animate-pulse">
                <div className="h-28 bg-muted" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-14 bg-muted rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((work, index) => (
              <WorkCard key={`${work.category}-${work.id}`} work={work} index={index} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full mb-5"
              style={{ background: "hsl(36 70% 50% / 0.1)" }}
            >
              <BookOpen className="h-9 w-9 text-primary/60" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground">{t("browse.noneFoundTitle", "No works found")}</h3>
            <p className="mt-2 font-body text-sm text-muted-foreground max-w-xs">
              {t("browse.noneFoundDesc", "Try changing your search or selected category.")}
            </p>
            <button
              onClick={() => { setSearch(""); setCategory("all"); }}
              className="mt-5 inline-flex items-center gap-2 font-ui text-sm font-medium text-primary hover:underline px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors"
            >
              {t("browse.clearFilters", "Clear filters")}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PublicBrowsePage;



