import { motion } from "framer-motion";
import { BookOpen, FileText, Layers, PenLine } from "lucide-react";

export type PublicBrowseCategory = "all" | "books" | "stories" | "poems";

const categories = [
  { key: "all", label: "All Works", icon: Layers },
  { key: "books", label: "Books", icon: BookOpen },
  { key: "stories", label: "Stories", icon: FileText },
  { key: "poems", label: "Poetry", icon: PenLine },
] as const;

interface CategoryFilterProps {
  active: PublicBrowseCategory;
  onChange: (cat: PublicBrowseCategory) => void;
}

const CategoryFilter = ({ active, onChange }: CategoryFilterProps) => (
  <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap">
    {categories.map((cat) => {
      const isActive = active === cat.key;
      return (
        <button
          key={cat.key}
          onClick={() => onChange(cat.key)}
          className={`relative flex items-center gap-1.5 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-medium font-ui transition-all duration-200 border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive
            ? "text-white border-transparent shadow-sm"
            : "text-muted-foreground border-border bg-background hover:border-primary/40 hover:text-foreground"
            }`}
          style={isActive ? { background: "var(--hero-gradient)" } : undefined}
        >
          {isActive && (
            <motion.span
              layoutId="filter-pill"
              className="absolute inset-0 rounded-full"
              style={{ background: "var(--hero-gradient)" }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">
            <cat.icon className="h-3.5 w-3.5" />
            {cat.label}
          </span>
        </button>
      );
    })}
  </div>
);

export default CategoryFilter;
