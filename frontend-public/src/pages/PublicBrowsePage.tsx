import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import WorkCard, { type PublicWorkCardItem } from "@/components/WorkCard";
import CategoryFilter, { type PublicBrowseCategory } from "@/components/CategoryFilter";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { resolveAuthorKey } from "@/lib/authors";
import { fetchContent, fetchTrending, resolveMediaUrl } from "@/lib/api";
import type { ContentItem } from "@/lib/types";

const CATEGORY_COLOR_PALETTE: Record<"books" | "stories" | "poems", string[]> = {
  books: ["hsl(24, 60%, 55%)", "hsl(32, 50%, 48%)", "hsl(14, 55%, 52%)"],
  stories: ["hsl(215, 40%, 45%)", "hsl(228, 35%, 50%)", "hsl(200, 45%, 42%)"],
  poems: ["hsl(150, 25%, 45%)", "hsl(165, 30%, 40%)", "hsl(135, 20%, 50%)"],
};

function toExcerpt(item: ContentItem): string {
  const rawHtml = item.description || item.extracted_text || item.body || "";
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

type SortOption = "new" | "top" | "trending";

const SORT_OPTIONS: { value: SortOption; labelKey: string; defaultLabel: string }[] = [
  { value: "new", labelKey: "browse.sort.new", defaultLabel: "New" },
  { value: "trending", labelKey: "browse.sort.trending", defaultLabel: "Trending" },
  { value: "top", labelKey: "browse.sort.top", defaultLabel: "Top" },
];

const PublicBrowsePage = () => {
  const { t, language } = useI18n();
  const [category, setCategory] = useState<PublicBrowseCategory>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("new");
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

  const trendingWeekQuery = useQuery({
    queryKey: ["browse-trending-week"],
    queryFn: () => fetchTrending("week", 120),
  });

  const filtered = useMemo(() => {
    const works = worksQuery.data || [];
    const trendingScoreByKey = new Map(
      (trendingWeekQuery.data || []).map((item) => [`${item.category}-${item.id}`, item.score || 0]),
    );
    const rows = works.filter((item) => {
      const matchCategory = category === "all" || item.category === category;
      const text = `${item.title} ${item.author} ${item.excerpt}`.toLowerCase();
      const matchSearch = text.includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });

    if (sort === "new") {
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      rows.sort(
        (a, b) =>
          Number(trendingScoreByKey.get(`${b.category}-${b.id}`) || 0) -
          Number(trendingScoreByKey.get(`${a.category}-${a.id}`) || 0),
      );
    }
    return rows;
  }, [worksQuery.data, trendingWeekQuery.data, category, search, sort]);

  return (
    <div>
      {/* ── Sticky filter + search bar ── */}
      <div className="sticky top-0 z-40 bg-background/97 backdrop-blur-md border-b border-border/40 shadow-sm">
        {/* Search bar */}
        <div className="container mx-auto px-4 sm:px-6 pt-3 pb-2">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t("browse.searchPlaceholder", "Search by title or author...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 font-ui h-11 text-sm rounded-xl bg-muted/40 border-transparent focus:border-primary/40 focus:bg-background transition-all"
            />
          </div>
        </div>

        {/* Category + sort row */}
        <div className="container mx-auto px-4 sm:px-6 pb-3">
          <div className="flex items-center justify-between gap-3">
            {/* Category pills */}
            <div className="flex-1 overflow-x-auto scrollbar-none">
              <CategoryFilter active={category} onChange={setCategory} />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger className="h-8 w-[130px] rounded-full text-xs font-ui font-semibold bg-muted/50 border-0 hover:bg-muted focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs font-ui">
                      {t(opt.labelKey, opt.defaultLabel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Page header (non-sticky) ── */}
      <div className="container mx-auto px-4 sm:px-6 pt-6 pb-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground md:text-4xl">
                {t("browse.title", "Library")}
              </h1>
              <p className="mt-1 font-ui text-sm text-muted-foreground">
                {t("browse.subtitle", "Discover books, stories, and poetry from the community")}
              </p>
            </div>
            {!worksQuery.isLoading && (
              <span className="hidden sm:inline-flex items-center rounded-full px-3 py-1 text-xs font-ui font-medium text-muted-foreground border border-border/50 bg-muted/30 flex-shrink-0">
                {filtered.length} {filtered.length === 1 ? t("browse.work", "work") : t("browse.works", "works")}
              </span>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Content ── */}
      <div className="container mx-auto px-4 sm:px-6 py-4 pb-24 md:pb-10">
        {worksQuery.isLoading ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
            <h3 className="font-display text-xl font-semibold text-foreground">
              {t("browse.noneFoundTitle", "No works found")}
            </h3>
            <p className="mt-2 font-body text-sm text-muted-foreground max-w-xs">
              {t("browse.noneFoundDesc", "Try changing your search or selected category.")}
            </p>
            <button
              onClick={() => { setSearch(""); setCategory("all"); }}
              style={{ touchAction: "manipulation" }}
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
