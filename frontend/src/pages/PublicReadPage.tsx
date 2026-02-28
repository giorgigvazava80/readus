import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Clock, Share2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { fetchContentDetail } from "@/lib/api";
import type { ContentCategory, ContentDetail } from "@/lib/types";

const categoryLabels: Record<ContentCategory, string> = {
  books: "Book",
  chapters: "Chapter",
  poems: "Poetry",
  stories: "Short Story",
};

const allowedCategories: ContentCategory[] = ["books", "chapters", "poems", "stories"];

function stripHtml(value: string | undefined): string {
  return (value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function estimateReadTime(content: ContentDetail): string {
  const parts = [
    content.description,
    content.body,
    content.foreword,
    content.afterword,
    ...(content.chapters?.map((chapter) => chapter.body) || []),
  ];

  const words = stripHtml(parts.join(" ")).split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return `${minutes} min read`;
}

const PublicReadPage = () => {
  const { category: rawCategory, id: rawId } = useParams();
  const contentId = Number(rawId);

  const category = allowedCategories.includes(rawCategory as ContentCategory)
    ? (rawCategory as ContentCategory)
    : null;

  const detailQuery = useQuery({
    queryKey: ["public-read", category, contentId],
    queryFn: () => fetchContentDetail(category as ContentCategory, contentId),
    enabled: Boolean(category) && Number.isFinite(contentId),
  });

  if (!category || !Number.isFinite(contentId)) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Invalid Content Link</h1>
        <Link to="/browse">
          <Button variant="outline" className="mt-4">Back to Library</Button>
        </Link>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return <div className="container mx-auto px-6 py-24 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Work Not Found</h1>
        <Link to="/browse">
          <Button variant="outline" className="mt-4">Back to Library</Button>
        </Link>
      </div>
    );
  }

  const content = detailQuery.data;
  const chapters = (content.chapters || []).slice().sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="border-b">
        <div className="container mx-auto px-6 py-8">
          <Link to="/browse">
            <Button variant="ghost" size="sm" className="mb-4 gap-1.5 font-ui text-sm text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Library
            </Button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary" className="font-ui text-xs">
                {categoryLabels[category]}
              </Badge>
            </div>

            <h1 className="font-display text-3xl font-bold leading-tight text-foreground md:text-4xl">
              {content.title}
            </h1>
            <p className="mt-2 font-ui text-base text-muted-foreground">
              by {content.author_name || content.author_username || "Unknown author"}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4 font-ui text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {estimateReadTime(content)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {new Date(content.created_at).toLocaleDateString()}
              </span>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="container mx-auto px-6 py-12"
      >
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 h-1.5 w-16 rounded-full bg-primary" />

          {content.upload_file ? (
            <p className="mb-6 text-sm text-muted-foreground">
              Uploaded file: <a className="underline" href={content.upload_file} target="_blank" rel="noreferrer">Open file</a>
            </p>
          ) : null}

          {content.description ? (
            <div
              className="reader-html prose-literary mb-8 text-foreground/85"
              dangerouslySetInnerHTML={{ __html: content.description }}
            />
          ) : null}

          {category === "books" ? (
            <div className="space-y-8">
              {content.foreword ? (
                <section>
                  <h2 className="font-display text-2xl font-semibold text-foreground">Foreword</h2>
                  <div
                    className="reader-html prose-literary mt-3 text-foreground/90"
                    dangerouslySetInnerHTML={{ __html: content.foreword }}
                  />
                </section>
              ) : null}

              {chapters.map((chapter) => (
                <section key={chapter.id}>
                  <h2 className="font-display text-2xl font-semibold text-foreground">
                    {chapter.title || `Chapter ${chapter.auto_label || chapter.order}`}
                  </h2>
                  <div
                    className="reader-html prose-literary mt-3 text-foreground/90"
                    dangerouslySetInnerHTML={{ __html: chapter.body || "<p>No chapter content.</p>" }}
                  />
                </section>
              ))}

              {content.afterword ? (
                <section>
                  <h2 className="font-display text-2xl font-semibold text-foreground">Afterword</h2>
                  <div
                    className="reader-html prose-literary mt-3 text-foreground/90"
                    dangerouslySetInnerHTML={{ __html: content.afterword }}
                  />
                </section>
              ) : null}

              {!content.foreword && !chapters.length && !content.afterword && content.extracted_text ? (
                <section>
                  <h2 className="font-display text-2xl font-semibold text-foreground">Uploaded Text</h2>
                  <pre className="prose-literary mt-3 whitespace-pre-wrap text-foreground/90">{content.extracted_text}</pre>
                </section>
              ) : null}

              {!content.foreword && !chapters.length && !content.afterword && !content.extracted_text ? (
                <p className="font-ui text-sm text-muted-foreground">No readable text available.</p>
              ) : null}
            </div>
          ) : content.body ? (
            <div
              className="reader-html prose-literary text-foreground/90"
              dangerouslySetInnerHTML={{ __html: content.body }}
            />
          ) : content.extracted_text ? (
            <pre className="prose-literary whitespace-pre-wrap text-foreground/90">{content.extracted_text}</pre>
          ) : (
            <p className="font-ui text-sm text-muted-foreground">No readable text available.</p>
          )}

          <Separator className="my-12" />

          <div className="text-center">
            <p className="font-display text-lg italic text-muted-foreground">End of preview</p>
            <p className="mt-2 font-ui text-sm text-muted-foreground">
              Join as reader to like, comment, and follow authors.
            </p>
          </div>
        </div>
      </motion.article>
    </div>
  );
};

export default PublicReadPage;
