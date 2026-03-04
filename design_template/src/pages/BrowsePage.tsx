import { useState } from "react";
import { motion } from "framer-motion";
import WorkCard from "@/components/WorkCard";
import CategoryFilter from "@/components/CategoryFilter";
import { featuredWorks } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Search, BookOpen } from "lucide-react";

const BrowsePage = () => {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = featuredWorks.filter((w) => {
    const matchCat = category === "all" || w.category === category;
    const matchSearch =
      w.title.toLowerCase().includes(search.toLowerCase()) ||
      w.author.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">
            Browse Library
          </h1>
          <p className="mt-1.5 font-ui text-sm text-muted-foreground">
            Discover novels, stories, and poetry from our community
          </p>
        </div>

        {/* Sticky filter bar */}
        <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-8 glass-panel border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <CategoryFilter active={category} onChange={setCategory} />
              {/* Result count */}
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-ui font-medium text-muted-foreground border"
              >
                {filtered.length} {filtered.length === 1 ? "work" : "works"}
              </span>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title or author..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 font-ui h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Results grid */}
        {filtered.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((work, i) => (
              <WorkCard key={work.id} work={work} index={i} />
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
            <h3 className="font-display text-lg font-semibold text-foreground">
              No works found
            </h3>
            <p className="mt-1.5 font-body text-sm text-muted-foreground max-w-xs">
              Try adjusting your search or category filter to find what you're looking for.
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

export default BrowsePage;
