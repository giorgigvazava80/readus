import { motion } from "framer-motion";
import { BookOpen, FileText, Layers, PenLine } from "lucide-react";

import { useI18n } from "@/i18n";

export type PublicBrowseCategory = "all" | "books" | "stories" | "poems";

const categories = [
  { key: "all", labelKey: "category.allWorks", defaultLabel: "All Works", icon: Layers },
  { key: "books", labelKey: "category.books", defaultLabel: "Books", icon: BookOpen },
  { key: "stories", labelKey: "category.stories", defaultLabel: "Stories", icon: FileText },
  { key: "poems", labelKey: "category.poems", defaultLabel: "Poetry", icon: PenLine },
] as const;

interface CategoryFilterProps {
  active: PublicBrowseCategory;
  onChange: (cat: PublicBrowseCategory) => void;
}

const CategoryFilter = ({ active, onChange }: CategoryFilterProps) => {
  const { t } = useI18n();

  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap">
      {categories.map((cat) => {
        const isActive = active === cat.key;
        return (
          <button
            key={cat.key}
            onClick={() => onChange(cat.key)}
            className={`relative flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium font-ui transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3.5 sm:py-1.5 ${
              isActive
                ? "border-transparent text-white shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
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
              {t(cat.labelKey, cat.defaultLabel)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFilter;
