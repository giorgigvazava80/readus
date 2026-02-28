import { Button } from "@/components/ui/button";
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
  <div className="flex flex-wrap gap-2">
    {categories.map((cat) => (
      <Button
        key={cat.key}
        variant={active === cat.key ? "default" : "outline"}
        size="sm"
        className="gap-1.5 font-ui"
        onClick={() => onChange(cat.key)}
      >
        <cat.icon className="h-3.5 w-3.5" />
        {cat.label}
      </Button>
    ))}
  </div>
);

export default CategoryFilter;
