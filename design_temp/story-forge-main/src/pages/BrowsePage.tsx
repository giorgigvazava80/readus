import { useState } from "react";
import { motion } from "framer-motion";
import WorkCard from "@/components/WorkCard";
import CategoryFilter from "@/components/CategoryFilter";
import { featuredWorks } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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
    <div className="container mx-auto px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground">Browse Library</h1>
        <p className="mt-1 font-ui text-sm text-muted-foreground">
          Discover novels, stories, and poetry from our community
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CategoryFilter active={category} onChange={setCategory} />
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title or author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 font-ui"
            />
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((work, i) => (
            <WorkCard key={work.id} work={work} index={i} />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-12 text-center font-body text-muted-foreground">
            No works found matching your criteria.
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default BrowsePage;
