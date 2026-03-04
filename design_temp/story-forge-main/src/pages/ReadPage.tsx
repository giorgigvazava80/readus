import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Clock, Calendar, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { featuredWorks, sampleChapterContent } from "@/lib/mockData";

const categoryLabels = { novel: "Novel", story: "Short Story", poem: "Poetry" };

const ReadPage = () => {
  const { id } = useParams();
  const work = featuredWorks.find((w) => w.id === id);

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
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-6 py-8">
          <Link to="/browse">
            <Button variant="ghost" size="sm" className="mb-4 gap-1.5 font-ui text-sm text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Library
            </Button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="font-ui text-xs">
                {categoryLabels[work.category]}
              </Badge>
              {work.chapters && (
                <span className="font-ui text-xs text-muted-foreground">
                  {work.chapters} chapters
                </span>
              )}
            </div>

            <h1 className="font-display text-3xl font-bold leading-tight text-foreground md:text-4xl">
              {work.title}
            </h1>
            <p className="mt-2 font-ui text-base text-muted-foreground">by {work.author}</p>

            <div className="mt-4 flex flex-wrap items-center gap-4 font-ui text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {work.readTime}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {work.date}
              </span>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
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
        className="container mx-auto px-6 py-12"
      >
        <div className="mx-auto max-w-2xl">
          {/* Decorative drop cap area */}
          <div
            className="mb-6 h-1.5 w-16 rounded-full"
            style={{ background: work.coverColor }}
          />

          {work.category === "novel" && (
            <h2 className="mb-6 font-display text-xl font-semibold text-foreground">
              Chapter 1
            </h2>
          )}

          <div className="prose-literary text-foreground/85">
            {sampleChapterContent.split("\n\n").map((paragraph, i) => (
              <p key={i} className="mb-5">
                {i === 0 ? (
                  <>
                    <span className="font-display text-5xl font-bold leading-none float-left mr-3 mt-1 text-primary">
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

          <Separator className="my-12" />

          <div className="text-center">
            <p className="font-display text-lg italic text-muted-foreground">
              End of preview
            </p>
            <p className="mt-2 font-ui text-sm text-muted-foreground">
              The full work contains {work.chapters || 1} {work.chapters ? "chapters" : "part"}.
            </p>
          </div>
        </div>
      </motion.article>
    </div>
  );
};

export default ReadPage;
