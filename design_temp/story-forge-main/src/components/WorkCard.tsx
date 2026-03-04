import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, FileText, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Work } from "@/lib/mockData";

const categoryIcons = {
  novel: BookOpen,
  story: FileText,
  poem: PenLine,
};

const categoryLabels = {
  novel: "Novel",
  story: "Short Story",
  poem: "Poetry",
};

interface WorkCardProps {
  work: Work;
  index?: number;
}

const WorkCard = ({ work, index = 0 }: WorkCardProps) => {
  const Icon = categoryIcons[work.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link to={`/read/${work.id}`} className="group block">
        <article className="overflow-hidden rounded-lg border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1">
          {/* Color band */}
          <div
            className="h-2 w-full"
            style={{ background: work.coverColor }}
          />
          <div className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 font-ui text-xs">
                <Icon className="h-3 w-3" />
                {categoryLabels[work.category]}
              </Badge>
              <span className="text-xs text-muted-foreground">{work.readTime}</span>
            </div>

            <h3 className="font-display text-lg font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
              {work.title}
            </h3>
            <p className="mt-1 font-ui text-sm text-muted-foreground">
              by {work.author}
            </p>

            <p className="mt-3 font-body text-sm leading-relaxed text-foreground/70 line-clamp-3">
              {work.excerpt}
            </p>

            {work.chapters && (
              <p className="mt-3 font-ui text-xs text-muted-foreground">
                {work.chapters} chapters
              </p>
            )}
          </div>
        </article>
      </Link>
    </motion.div>
  );
};

export default WorkCard;
