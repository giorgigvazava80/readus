import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookText, ListTree, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { fetchContentDetail } from "@/lib/api";
import { useReadChapters } from "@/hooks/useReadChapters";

const hasTextContent = (html?: string | null) => {
  if (!html) return false;
  const stripped = html.replace(/<[^>]+>/g, "").trim();
  return stripped.length > 0;
};

const ReaderBookDetailPage = () => {
  const { identifier } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const contentIdentifier = (identifier || "").trim();
  const { isRead } = useReadChapters();

  const bookQuery = useQuery({
    queryKey: ["reader", "book", contentIdentifier],
    queryFn: () => fetchContentDetail("books", contentIdentifier),
    enabled: Boolean(contentIdentifier),
  });

  useEffect(() => {
    if (!bookQuery.data?.public_slug || contentIdentifier === bookQuery.data.public_slug) {
      return;
    }
    const target = `/books/${bookQuery.data.public_slug}`;
    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [bookQuery.data?.public_slug, contentIdentifier, location.pathname, navigate]);

  if (!contentIdentifier) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">წიგნის ბმული არასწორია.</p>
      </div>
    );
  }

  if (bookQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">წიგნი იტვირთება...</p>
      </div>
    );
  }

  if (bookQuery.isError || !bookQuery.data) {
    return (
      <div className="container mx-auto px-6 py-10 space-y-4">
        <p className="font-ui text-sm text-red-700">წიგნი ვერ მოიძებნა.</p>
        <Link to="/books">
          <Button variant="outline">წიგნებზე დაბრუნება</Button>
        </Link>
      </div>
    );
  }

  const book = bookQuery.data;
  const canonicalIdentifier = (book.public_slug || contentIdentifier).trim();
  const chapters = (book.chapters || []).slice().sort((a, b) => a.order - b.order);

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <Link to="/books">
          <Button variant="ghost" size="sm" className="gap-1.5 font-ui text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            წიგნებზე დაბრუნება
          </Button>
        </Link>

        <div className="flex items-center justify-between gap-4 mt-3">
          <h1 className="font-display text-4xl font-semibold text-foreground">{book.title}</h1>
          {book.is_hidden && (
            <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 gap-1.5 px-3 py-1">
              <EyeOff className="h-4 w-4" />
              Hidden from Public
            </Badge>
          )}
        </div>
        <p className="mt-1 font-ui text-sm text-muted-foreground">
          by {book.author_name || book.author_username || "უცნობი ავტორი"}
        </p>

        {book.description ? (
          <div className="reader-html prose-literary mt-5 text-foreground/85" dangerouslySetInnerHTML={{ __html: book.description }} />
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <aside className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-card lg:sticky lg:top-24 lg:h-fit">
          <div className="flex items-center gap-2">
            <ListTree className="h-4 w-4 text-primary" />
            <h2 className="font-display text-2xl text-foreground">სარჩევი</h2>
          </div>

          <div className="mt-4 space-y-2">
            {chapters.length ? (
              chapters.map((chapter) => (
                <Link key={chapter.id} to={`/books/${canonicalIdentifier}/chapters/${chapter.id}`} className="flex justify-between items-center rounded-lg border border-border/60 bg-background/65 px-3 py-2 font-ui text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary">
                  <span>{chapter.title || `Chapter ${chapter.auto_label || chapter.order}`}</span>
                  {!isRead(chapter.id) && (
                    <span className="flex-shrink-0 ml-2 rounded-full px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-blue-500/20 text-blue-500">
                      New
                    </span>
                  )}
                </Link>
              ))
            ) : (
              <p className="font-ui text-sm text-muted-foreground">თავები ჯერ არ არის.</p>
            )}
          </div>
        </aside>

        <article className="lg:col-span-2 rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
          {hasTextContent(book.foreword) ? (
            <>
              <div className="flex items-center gap-2">
                <BookText className="h-4 w-4 text-primary" />
                <h3 className="font-display text-2xl text-foreground">წინასიტყვაობა</h3>
              </div>
              <div className="reader-html prose-literary mt-4 text-foreground/90" dangerouslySetInnerHTML={{ __html: book.foreword }} />
            </>
          ) : book.extracted_text ? (
            <>
              <div className="flex items-center gap-2">
                <BookText className="h-4 w-4 text-primary" />
                <h3 className="font-display text-2xl text-foreground">ატვირთული ტექსტი</h3>
              </div>
              <pre className="prose-literary mt-4 whitespace-pre-wrap text-foreground/90">{book.extracted_text}</pre>
            </>
          ) : (
            <p className="font-ui text-sm text-muted-foreground">
              This book has no foreword. Open a chapter from the table of contents.
            </p>
          )}

          {hasTextContent(book.afterword) ? (
            <>
              <Separator className="my-8" />
              <h3 className="font-display text-2xl text-foreground">ბოლოსიტყვაობა</h3>
              <div className="reader-html prose-literary mt-4 text-foreground/90" dangerouslySetInnerHTML={{ __html: book.afterword }} />
            </>
          ) : null}
        </article>
      </section>
    </div>
  );
};

export default ReaderBookDetailPage;





