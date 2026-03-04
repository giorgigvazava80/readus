import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Clock, Calendar, Share2, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { featuredWorks, sampleChapterContent } from "@/lib/mockData";
import { useState, useEffect } from "react";

const categoryLabels = { novel: "Novel", story: "Short Story", poem: "Poetry" };

const ReadPage = () => {
  const { id } = useParams();
  const work = featuredWorks.find((w) => w.id === id);
  const [readProgress, setReadProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handler = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setReadProgress(Math.round(progress));
      setShowScrollTop(scrollTop > 400);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  if (!work) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Work Not Found</h1>
        <Link to="/browse">
          <Button variant="outline" className="mt-4">Back to Library</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Reading progress bar */}
      <div
        className="reading-progress"
        style={{ width: `${readProgress}%` }}
      />

      {/* Header */}
      <div className="border-b">
        <div
          className="h-1.5 w-full"
          style={{ background: work.coverColor }}
        />
        <div className="container mx-auto px-4 sm:px-6 py-8">
          <Link to="/browse">
            <Button
              variant="ghost"
              size="sm"
              className="mb-5 gap-1.5 font-ui text-sm text-muted-foreground hover:text-foreground -ml-1 group"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Back to Library
            </Button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge
                variant="secondary"
                className="font-ui text-xs"
              >
                {categoryLabels[work.category]}
              </Badge>
              {work.chapters && (
                <span className="font-ui text-xs text-muted-foreground">
                  {work.chapters} chapters
                </span>
              )}
            </div>

            <h1 className="font-display text-3xl font-bold leading-tight text-foreground md:text-4xl lg:text-5xl max-w-2xl">
              {work.title}
            </h1>
            <p className="mt-2 font-ui text-base text-muted-foreground">
              by <span className="text-foreground font-medium">{work.author}</span>
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-4 font-ui text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {work.readTime}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {work.date}
              </span>
              {readProgress > 0 && (
                <span className="flex items-center gap-1.5 text-primary">
                  <BookOpen className="h-3.5 w-3.5" />
                  {readProgress}% read
                </span>
              )}
              <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-muted-foreground hover:text-foreground -ml-1">
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="container mx-auto px-4 sm:px-6 py-12"
      >
        <div className="mx-auto max-w-2xl">
          {/* Color accent */}
          <div
            className="mb-8 h-1 w-20 rounded-full"
            style={{ background: work.coverColor }}
          />

          {work.category === "novel" && (
            <h2 className="mb-8 font-display text-xl font-semibold text-foreground">
              Chapter 1
            </h2>
          )}

          <div className="prose-literary text-foreground/80">
            {sampleChapterContent.split("\n\n").map((paragraph, i) => (
              <p key={i} className="mb-6">
                {i === 0 ? (
                  <>
                    <span
                      className="font-display text-6xl font-bold leading-none float-left mr-3 mt-1"
                      style={{ color: work.coverColor }}
                    >
                      {paragraph.charAt(0)}
                    </span>
                    {paragraph.slice(1)}
                  </>
                ) : (
                  paragraph
                )}
              </p>
            ))}
          </div>

          <Separator className="my-14" />

          <div className="text-center">
            <p className="font-display text-xl italic text-muted-foreground">
              — End of preview —
            </p>
            <p className="mt-2 font-ui text-sm text-muted-foreground">
              The full work contains {work.chapters || 1}{" "}
              {work.chapters ? "chapters" : "part"}.
            </p>
            <Link to="/browse" className="mt-6 inline-block">
              <Button variant="outline" className="gap-2 font-ui">
                <BookOpen className="h-4 w-4" />
                Discover More Works
              </Button>
            </Link>
          </div>
        </div>
      </motion.article>

      {/* Scroll to top */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: showScrollTop ? 1 : 0, scale: showScrollTop ? 1 : 0.8 }}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg bg-background/90 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        aria-label="Scroll to top"
      >
        <ChevronUp className="h-4 w-4" />
      </motion.button>
    </div>
  );
};

export default ReadPage;
