import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import ReadingFontSizeControl from "@/components/reader/ReadingFontSizeControl";
import { Button } from "@/components/ui/button";
import { fetchContentDetail } from "@/lib/api";
import { getStoredReadingFontSize, readingFontSizeClassByPreference, setStoredReadingFontSize, type ReadingFontSize } from "@/lib/fontSize";
import { cn } from "@/lib/utils";
import { useReadChapters } from "@/hooks/useReadChapters";
import { useI18n } from "@/i18n";

const ReaderChapterReadPage = () => {
  const { t } = useI18n();
  const { identifier, chapterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const bookIdentifier = (identifier || "").trim();
  const currentChapterId = Number(chapterId);
  const { markAsRead } = useReadChapters();
  const [fontSize, setFontSize] = useState<ReadingFontSize>(() => getStoredReadingFontSize());
  const readingFontSizeClass = readingFontSizeClassByPreference[fontSize];

  const bookQuery = useQuery({
    queryKey: ["reader", "book", bookIdentifier, "chapter", currentChapterId],
    queryFn: () => fetchContentDetail("books", bookIdentifier),
    enabled: Boolean(bookIdentifier) && Number.isFinite(currentChapterId),
  });

  const book = bookQuery.data;
  const chapters = useMemo(() => (book?.chapters || []).slice().sort((a, b: any) => a.order - b.order), [book]);
  const currentIndex = useMemo(() => chapters.findIndex((ch) => ch.id === currentChapterId), [chapters, currentChapterId]);
  const chapter = currentIndex >= 0 ? chapters[currentIndex] : null;

  useEffect(() => {
    if (chapter) {
      markAsRead(chapter.id);
    }
  }, [chapter, markAsRead]);

  useEffect(() => {
    if (!book?.public_slug || bookIdentifier === book.public_slug || !Number.isFinite(currentChapterId)) {
      return;
    }
    const target = `/books/${book.public_slug}/chapters/${currentChapterId}`;
    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [book?.public_slug, bookIdentifier, currentChapterId, location.pathname, navigate]);

  if (!bookIdentifier || !Number.isFinite(currentChapterId)) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("reader.chapterInvalidLink", "Chapter link is invalid.")}</p>
      </div>
    );
  }

  if (bookQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("reader.chapterLoading", "Loading chapter...")}</p>
      </div>
    );
  }

  if (bookQuery.isError || !book) {
    return (
      <div className="container mx-auto px-6 py-10 space-y-4">
        <p className="font-ui text-sm text-red-700">{t("reader.chapterLoadError", "Could not load chapter.")}</p>
        <Link to="/books">
          <Button variant="outline">{t("reader.backToBooks", "Back to books")}</Button>
        </Link>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="container mx-auto px-6 py-10 space-y-4">
        <p className="font-ui text-sm text-red-700">{t("reader.chapterNotFound", "This chapter was not found in the book.")}</p>
        <Link to={`/books/${book.public_slug || bookIdentifier}`}>
          <Button variant="outline">{t("reader.backToContents", "Back to contents")}</Button>
        </Link>
      </div>
    );
  }

  const canonicalBookIdentifier = (book.public_slug || bookIdentifier).trim();
  const previousChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
  const handleReadingFontSizeChange = (next: ReadingFontSize) => {
    setStoredReadingFontSize(next);
    setFontSize(next);
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <Link to={`/books/${canonicalBookIdentifier}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 font-ui text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t("reader.backToContents", "Back to contents")}
          </Button>
        </Link>

        <p className="mt-4 font-ui text-xs uppercase tracking-wide text-muted-foreground">{book.title}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-foreground">
          {chapter.title || t("reader.chapterUntitled", "Chapter {number}").replace("{number}", String(chapter.auto_label || chapter.order))}
        </h1>
      </section>

      <ReadingFontSizeControl value={fontSize} onChange={handleReadingFontSizeChange} />

      <article className={cn("reader-html prose-literary rounded-2xl border border-border/70 bg-card/80 p-8 text-foreground/90 shadow-card", readingFontSizeClass)}>
        <div dangerouslySetInnerHTML={{ __html: chapter.body || `<p>${t("reader.chapterEmptyText", "This chapter has no text yet.")}</p>` }} />
      </article>

      <section className="flex flex-wrap items-center justify-between gap-3">
        {previousChapter ? (
          <Link to={`/books/${canonicalBookIdentifier}/chapters/${previousChapter.id}`}>
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              {t("reader.previous", "Previous")}
            </Button>
          </Link>
        ) : <span />}

        {nextChapter ? (
          <Link to={`/books/${canonicalBookIdentifier}/chapters/${nextChapter.id}`}>
            <Button variant="outline" className="gap-1.5">
              {t("reader.next", "Next")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : null}
      </section>
    </div>
  );
};

export default ReaderChapterReadPage;


