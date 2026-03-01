import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, FileText, PenLine, Clock, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import type { ContentCategory } from "@/lib/types";

export interface PublicWorkCardItem {
  id: number;
  publicSlug: string;
  title: string;
  author: string;
  excerpt: string;
  category: ContentCategory;
  coverColor: string;
  coverImageUrl?: string | null;
  date: string;
  readTime: string;
  createdAt: string;
  isHidden?: boolean;
}

const categoryIcons = {
  books: BookOpen,
  stories: FileText,
  poems: PenLine,
  chapters: FileText,
};

const categoryLabels = {
  books: "Book",
  stories: "Story",
  poems: "Poetry",
  chapters: "Chapter",
};

interface WorkCardProps {
  work: PublicWorkCardItem;
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
      <Link to={`/read/${work.category}/${work.publicSlug}`} className="group block h-full">
        <article className="relative h-full min-h-[320px] sm:min-h-[380px] overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col">

          {/* Background Layer with Photo/Color */}
          <div className="absolute inset-0 z-0 overflow-hidden bg-background">
            {work.coverImageUrl ? (
              <img
                src={work.coverImageUrl}
                alt={work.title}
                className="absolute inset-0 h-full w-full object-cover opacity-70 blur-[3px] scale-105 transition-transform duration-700 ease-out group-hover:scale-110"
              />
            ) : (
              <div
                className="absolute inset-0 h-full w-full opacity-60 blur-[3px] scale-105 transition-transform duration-700 ease-out group-hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${work.coverColor}, ${work.coverColor}99)`,
                }}
              >
                {/* Decorative orbs for solid colors */}
                <div className="absolute -top-4 -right-4 h-32 w-32 rounded-full opacity-40 bg-white" />
                <div className="absolute bottom-10 -left-10 h-24 w-24 rounded-full opacity-30 bg-white" />
              </div>
            )}
            {/* The crisp white glass overlay that makes text readable */}
            <div className="absolute inset-0 bg-white/40 backdrop-blur-sm pointer-events-none" />
          </div>

          {/* Foreground Content */}
          <div className="relative z-10 p-4 sm:p-5 flex flex-col flex-1 h-full">

            {/* Top row with Category Icon & Read Time */}
            <div className="mb-auto flex items-start justify-between gap-2 pb-6 sm:pb-12">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 backdrop-blur-md border border-white/60 shadow-sm text-foreground/80">
                <Icon className="h-5 w-5" />
              </div>

              <Badge variant="secondary" className="gap-1 font-ui text-[10px] uppercase tracking-wider px-2.5 py-1 bg-white/60 text-foreground hover:bg-white/80 backdrop-blur-md border border-white/60 shadow-sm transition-colors">
                <Clock className="h-3 w-3" />
                {work.readTime}
              </Badge>
            </div>

            {/* Bottom Content Area */}
            <div className="mt-auto">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-ui text-[10px] uppercase tracking-wider px-2 py-0 border-white/60 text-foreground bg-white/40 backdrop-blur-md shadow-sm">
                  {categoryLabels[work.category]}
                </Badge>
                {work.isHidden && (
                  <Badge variant="outline" className="font-ui text-[10px] uppercase tracking-wider px-2 py-0 border-amber-500/40 text-amber-900 bg-amber-500/20 backdrop-blur-md shadow-sm flex items-center gap-1">
                    <EyeOff className="h-2.5 w-2.5" />
                    Hidden
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h3 className="font-display text-lg sm:text-xl font-bold leading-tight text-foreground transition-colors group-hover:text-primary line-clamp-2 drop-shadow-sm">
                {work.title}
              </h3>

              <p className="mt-1.5 font-ui text-sm text-foreground/70 font-medium drop-shadow-sm">
                by <span className="text-foreground/90">{work.author}</span>
              </p>

              {/* Excerpt */}
              <p className="mt-4 line-clamp-3 font-body text-sm leading-relaxed text-foreground/85 drop-shadow-sm">
                {work.excerpt}
              </p>

              {/* Footer */}
              <div className="mt-5 border-t border-black/10 pt-4 flex flex-row items-center justify-between">
                <span className="font-ui text-xs font-medium text-foreground/60">{work.date}</span>
                <span className="flex items-center gap-1 font-ui text-xs font-bold text-primary transition-all duration-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 drop-shadow-sm">
                  Read now <span className="text-lg leading-none">→</span>
                </span>
              </div>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
};

export default WorkCard;
