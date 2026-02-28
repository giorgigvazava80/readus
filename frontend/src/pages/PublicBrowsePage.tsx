import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import WorkCard, { type PublicWorkCardItem } from "@/components/WorkCard";
import CategoryFilter, { type PublicBrowseCategory } from "@/components/CategoryFilter";
import { Input } from "@/components/ui/input";
import { fetchContent } from "@/lib/api";
import type { ContentItem } from "@/lib/types";

const CATEGORY_COLOR_PALETTE: Record<"books" | "stories" | "poems", string[]> = {
  books: ["hsl(36, 70%, 50%)", "hsl(32, 65%, 45%)", "hsl(28, 72%, 48%)"],
  stories: ["hsl(200, 45%, 42%)", "hsl(160, 40%, 38%)", "hsl(220, 50%, 44%)"],
  poems: ["hsl(10, 65%, 50%)", "hsl(350, 55%, 47%)", "hsl(280, 35%, 42%)"],
};

function toExcerpt(item: ContentItem): string {
  const raw = [item.body, item.extracted_text, item.description].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (!raw) {
    return "No preview available yet.";
  }
  if (raw.length <= 190) {
    return raw;
  }
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
    date: new Date(item.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    readTime: estimateReadTime(item),
    createdAt: item.created_at,
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
    <div className="container mx-auto px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground">Browse Library</h1>
        <p className="mt-1 font-ui text-sm text-muted-foreground">
          Discover books, stories, and poetry from the community
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CategoryFilter active={category} onChange={setCategory} />
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title or author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 font-ui"
            />
          </div>
        </div>

        {worksQuery.isLoading ? <p className="mt-8 text-sm text-muted-foreground">Loading library...</p> : null}

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((work, index) => (
            <WorkCard key={`${work.category}-${work.id}`} work={work} index={index} />
          ))}
        </div>

        {!worksQuery.isLoading && filtered.length === 0 ? (
          <p className="mt-12 text-center font-body text-muted-foreground">
            No works found matching your criteria.
          </p>
        ) : null}
      </motion.div>
    </div>
  );
};

export default PublicBrowsePage;
