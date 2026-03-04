import { Button } from "@/components/ui/button";
import { BookOpen, FileText, PenLine, Layers } from "lucide-react";

const categories = [
  { key: "all", label: "All Works", icon: Layers },
  { key: "novel", label: "Novels", icon: BookOpen },
  { key: "story", label: "Stories", icon: FileText },
  { key: "poem", label: "Poetry", icon: PenLine },
] as const;

interface CategoryFilterProps {
  active: string;
  onChange: (cat: string) => void;
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
