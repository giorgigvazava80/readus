import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, FileText, PenLine, Clock } from "lucide-react";
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
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
    >
      <Link to={`/read/${work.id}`} className="group block h-full">
        <article className="relative overflow-hidden rounded-xl border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1.5 h-full flex flex-col">
          {/* Gradient header band */}
          <div
            className="h-24 w-full relative overflow-hidden flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${work.coverColor}, ${work.coverColor}99)`,
            }}
          >
            {/* Decorative circles */}
            <div
              className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-20"
              style={{ background: "white" }}
            />
            <div
              className="absolute bottom-2 left-4 w-8 h-8 rounded-full opacity-15"
              style={{ background: "white" }}
            />
            {/* Category icon centered */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
                <Icon className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <div className="p-5 flex flex-col flex-1">
            {/* Meta row */}
            <div className="mb-3 flex items-center justify-between gap-2">
              <Badge
                variant="secondary"
                className="gap-1 font-ui text-xs px-2 py-0.5"
              >
                {categoryLabels[work.category]}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground font-ui">
                <Clock className="h-3 w-3" />
                {work.readTime}
              </span>
            </div>

            {/* Title */}
            <h3 className="font-display text-lg font-semibold leading-tight text-foreground transition-colors group-hover:text-primary line-clamp-2">
              {work.title}
            </h3>
            <p className="mt-1 font-ui text-sm text-muted-foreground">
              by {work.author}
            </p>

            {/* Excerpt */}
            <p className="mt-3 font-body text-sm leading-relaxed text-foreground/65 line-clamp-3 flex-1">
              {work.excerpt}
            </p>

            {/* Footer */}
            {work.chapters && (
              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                <span className="font-ui text-xs text-muted-foreground">
                  {work.chapters} chapters
                </span>
                <span className="font-ui text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Read now →
                </span>
              </div>
            )}
          </div>
        </article>
      </Link>
    </motion.div>
  );
};

export default WorkCard;
