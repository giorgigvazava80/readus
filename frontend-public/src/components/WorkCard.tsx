import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, EyeOff, FileText, PenLine } from "lucide-react";

import { authorProfilePath } from "@/lib/authors";
import type { ContentCategory } from "@/lib/types";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";

export interface PublicWorkCardItem {
  id: number;
  publicSlug: string;
  title: string;
  author: string;
  authorKey: string;
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
  books: { key: "category.book", fallback: "Book" },
  stories: { key: "category.story", fallback: "Story" },
  poems: { key: "category.poem", fallback: "Poem" },
  chapters: { key: "category.chapter", fallback: "Chapter" },
};

interface WorkCardProps {
  work: PublicWorkCardItem;
  index?: number;
}

const WorkCard = ({ work, index = 0 }: WorkCardProps) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const Icon = categoryIcons[work.category];
  const authorLink = authorProfilePath(work.authorKey);

  const handleOpenWork = () => {
    navigate(`/read/${work.category}/${work.publicSlug}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.045, ease: "easeOut" }}
      className="h-full"
    >
      <article
        role="link"
        tabIndex={0}
        onClick={handleOpenWork}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleOpenWork();
          }
        }}
        className="group relative flex flex-col h-full cursor-pointer focus:outline-none touch-action-manip"
      >
        {/* ── Cover Container ── */}
        <div className="relative w-full aspect-[2/3] overflow-hidden rounded-xl sm:rounded-2xl shadow-sm border border-border/30 transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-1 bg-muted/20">

          {/* Cover image or gradient placeholder */}
          {work.coverImageUrl ? (
            <img
              src={work.coverImageUrl}
              alt={work.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div
              className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-110"
              style={{
                background: `linear-gradient(160deg, ${work.coverColor}cc, ${work.coverColor})`,
              }}
            >
              <Icon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 sm:h-14 sm:w-14 text-white/20" />
            </div>
          )}

          {/* ── Wattpad-style gradient scrim + title overlay ── */}
          <div className="cover-scrim absolute inset-0 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 z-10">
            <p className="font-display font-bold text-white text-sm sm:text-base leading-tight line-clamp-2 drop-shadow-sm">
              {work.title}
            </p>
            <p className="mt-0.5 font-ui text-[11px] sm:text-xs text-white/75 line-clamp-1">
              <span
                onClick={(e) => { e.stopPropagation(); navigate(authorLink); }}
                className="hover:underline cursor-pointer"
              >
                {work.author || t("workcard.anonymous", "anonymous")}
              </span>
            </p>
          </div>

          {/* Top badges */}
          <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1 z-10">
            <Badge
              variant="secondary"
              className="font-ui text-[9px] sm:text-[10px] uppercase tracking-wider px-1.5 sm:px-2 py-0.5 bg-black/40 text-white backdrop-blur-md border border-white/10 shadow-sm"
            >
              {t(categoryLabels[work.category].key, categoryLabels[work.category].fallback)}
            </Badge>
            {work.isHidden && (
              <Badge
                variant="outline"
                className="font-ui text-[9px] uppercase tracking-wider px-1.5 py-0.5 border-amber-500/40 text-white bg-amber-500/80 backdrop-blur-md shadow-sm"
              >
                <EyeOff className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>

          {/* Read-time badge bottom-right */}
          <div className="absolute top-2 right-2 z-10">
          </div>
        </div>

        {/* ── Minimal info row below cover (accessible fallback) ── */}
        {/* Title & author shown in overlay above; keep a tiny date line for a11y on desktop */}
        <div className="pt-1.5 px-0.5 hidden sm:flex flex-col flex-1">
          <p className="font-ui text-[10px] text-muted-foreground">{work.readTime.replace(" min read", "m read")}</p>
        </div>
      </article>
    </motion.div>
  );
};

export default WorkCard;
