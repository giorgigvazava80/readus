import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import WorkCard, { type PublicWorkCardItem } from "@/components/WorkCard";
import CategoryFilter, { type PublicBrowseCategory } from "@/components/CategoryFilter";
import { Input } from "@/components/ui/input";
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

  if (!raw) return "No preview available yet.";
  if (raw.length <= 190) return raw;
  return `${raw.slice(0, 187)}...`;
}

function estimateReadTime(item: ContentItem): string {
  const text = [item.body, item.extracted_text, item.description].filter(Boolean).join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return `${minutes} min read`;
}

function colorFor(category: "books" | "stories" | "poems", id: number): string {
  const palette = CATEGORY_COLOR_PALETTE[category];
  return palette[id % palette.length];
}

function toCardItem(category: "books" | "stories" | "poems", item: ContentItem): PublicWorkCardItem {
  return {
    id: item.id,
    category,
    title: item.title,
    author: item.author_name || item.author_username || "Unknown author",
    excerpt: toExcerpt(item),
    coverColor: colorFor(category, item.id),
    coverImageUrl: resolveMediaUrl(item.cover_image),
    date: new Date(item.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    readTime: estimateReadTime(item),
    createdAt: item.created_at,
    isHidden: item.is_hidden,
  };
}

const PublicBrowsePage = () => {
  const [category, setCategory] = useState<PublicBrowseCategory>("all");
  const [search, setSearch] = useState("");

  const worksQuery = useQuery({
    queryKey: ["public-browse", "all"],
    queryFn: async () => {
      const [books, stories, poems] = await Promise.all([
        fetchContent("books", { status: "approved", page: 1 }),
        fetchContent("stories", { status: "approved", page: 1 }),
        fetchContent("poems", { status: "approved", page: 1 }),
      ]);

      return [
        ...books.results.map((item) => toCardItem("books", item)),
        ...stories.results.map((item) => toCardItem("stories", item)),
        ...poems.results.map((item) => toCardItem("poems", item)),
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
    <div className="container mx-auto px-4 sm:px-6 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Library</h1>
          <p className="mt-1.5 font-ui text-sm text-muted-foreground">
            Discover books, stories, and poetry from the community
          </p>
        </div>

        {/* Sticky filter bar */}
        <div className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 mb-10 bg-background/95 backdrop-blur-md border-b border-border/40 shadow-sm transition-all duration-300">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <CategoryFilter active={category} onChange={setCategory} />
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-ui font-medium text-muted-foreground border border-white/10 bg-black/5">
                {worksQuery.isLoading ? "..." : `${filtered.length} ${filtered.length === 1 ? "work" : "works"}`}
              </span>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title or author..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 font-ui h-10 text-sm bg-background/50 border-white/10 focus:border-primary/30 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Loading skeleton */}
        {worksQuery.isLoading ? (
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border bg-card shadow-card overflow-hidden animate-pulse">
                <div className="h-24 bg-muted" />
                <div className="p-5 space-y-2">
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-12 bg-muted rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
              className="flex h-16 w-16 items-center justify-center rounded-full mb-4"
              style={{ background: "hsl(36 70% 50% / 0.1)" }}
            >
              <BookOpen className="h-7 w-7 text-primary/60" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">No works found</h3>
            <p className="mt-1.5 font-body text-sm text-muted-foreground max-w-xs">
              Try adjusting your search or category filter.
            </p>
            <button
              onClick={() => { setSearch(""); setCategory("all"); }}
              className="mt-4 font-ui text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default PublicBrowsePage;
