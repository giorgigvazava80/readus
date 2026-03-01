import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { fetchContentDetail } from "@/lib/api";
import { useReadChapters } from "@/hooks/useReadChapters";

const ReaderChapterReadPage = () => {
  const { identifier, chapterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const bookIdentifier = (identifier || "").trim();
  const currentChapterId = Number(chapterId);
  const { markAsRead } = useReadChapters();

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
        <p className="font-ui text-sm text-muted-foreground">თავის ბმული არასწორია.</p>
      </div>
    );
  }

  if (bookQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">თავი იტვირთება...</p>
      </div>
    );
  }

  if (bookQuery.isError || !book) {
    return (
      <div className="container mx-auto px-6 py-10 space-y-4">
        <p className="font-ui text-sm text-red-700">თავის ჩატვირთვა ვერ მოხერხდა.</p>
        <Link to="/books">
          <Button variant="outline">წიგნებზე დაბრუნება</Button>
        </Link>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="container mx-auto px-6 py-10 space-y-4">
        <p className="font-ui text-sm text-red-700">ამ წიგნში ეს თავი ვერ მოიძებნა.</p>
        <Link to={`/books/${book.public_slug || bookIdentifier}`}>
          <Button variant="outline">სარჩევზე დაბრუნება</Button>
        </Link>
      </div>
    );
  }

  const canonicalBookIdentifier = (book.public_slug || bookIdentifier).trim();
  const previousChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <Link to={`/books/${canonicalBookIdentifier}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 font-ui text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            სარჩევზე დაბრუნება
          </Button>
        </Link>

        <p className="mt-4 font-ui text-xs uppercase tracking-wide text-muted-foreground">{book.title}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-foreground">
          {chapter.title || `Chapter ${chapter.auto_label || chapter.order}`}
        </h1>
      </section>

      <article className="reader-html prose-literary rounded-2xl border border-border/70 bg-card/80 p-8 text-foreground/90 shadow-card">
        <div dangerouslySetInnerHTML={{ __html: chapter.body || "<p>თავის ტექსტი ჯერ არ არის.</p>" }} />
      </article>

      <section className="flex flex-wrap items-center justify-between gap-3">
        {previousChapter ? (
          <Link to={`/books/${canonicalBookIdentifier}/chapters/${previousChapter.id}`}>
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>
          </Link>
        ) : <span />}

        {nextChapter ? (
          <Link to={`/books/${canonicalBookIdentifier}/chapters/${nextChapter.id}`}>
            <Button variant="outline" className="gap-1.5">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : null}
      </section>
    </div>
  );
};

export default ReaderChapterReadPage;


