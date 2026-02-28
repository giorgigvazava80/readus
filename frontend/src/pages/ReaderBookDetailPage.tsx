import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookText, ListTree } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { fetchContentDetail } from "@/lib/api";

const ReaderBookDetailPage = () => {
  const { id } = useParams();
  const bookId = Number(id);

  const bookQuery = useQuery({
    queryKey: ["reader", "book", bookId],
    queryFn: () => fetchContentDetail("books", bookId),
    enabled: Number.isFinite(bookId),
  });

  if (!Number.isFinite(bookId)) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">Invalid book link.</p>
      </div>
    );
  }

  if (bookQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">Loading book...</p>
      </div>
    );
  }

  if (bookQuery.isError || !bookQuery.data) {
    return (
      <div className="container mx-auto px-6 py-10 space-y-4">
        <p className="font-ui text-sm text-red-700">Book not found.</p>
        <Link to="/books">
          <Button variant="outline">Back to books</Button>
        </Link>
      </div>
    );
  }

  const book = bookQuery.data;
  const chapters = (book.chapters || []).slice().sort((a, b) => a.order - b.order);

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <Link to="/books">
          <Button variant="ghost" size="sm" className="gap-1.5 font-ui text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to books
          </Button>
        </Link>

        <h1 className="mt-3 font-display text-4xl font-semibold text-foreground">{book.title}</h1>
        <p className="mt-1 font-ui text-sm text-muted-foreground">
          by {book.author_name || book.author_username || "Unknown author"}
        </p>

        {book.description ? (
          <div className="reader-html prose-literary mt-5 text-foreground/85" dangerouslySetInnerHTML={{ __html: book.description }} />
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <aside className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-card lg:sticky lg:top-24 lg:h-fit">
          <div className="flex items-center gap-2">
            <ListTree className="h-4 w-4 text-primary" />
            <h2 className="font-display text-2xl text-foreground">Contents</h2>
          </div>

          <div className="mt-4 space-y-2">
            {chapters.length ? (
              chapters.map((chapter) => (
                <Link key={chapter.id} to={`/books/${book.id}/chapters/${chapter.id}`} className="block rounded-lg border border-border/60 bg-background/65 px-3 py-2 font-ui text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary">
                  {chapter.title || `Chapter ${chapter.auto_label || chapter.order}`}
                </Link>
              ))
            ) : (
              <p className="font-ui text-sm text-muted-foreground">No chapters yet.</p>
            )}
          </div>
        </aside>

        <article className="lg:col-span-2 rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
          {book.foreword ? (
            <>
              <div className="flex items-center gap-2">
                <BookText className="h-4 w-4 text-primary" />
                <h3 className="font-display text-2xl text-foreground">Foreword</h3>
              </div>
              <div className="reader-html prose-literary mt-4 text-foreground/90" dangerouslySetInnerHTML={{ __html: book.foreword }} />
            </>
          ) : book.extracted_text ? (
            <>
              <div className="flex items-center gap-2">
                <BookText className="h-4 w-4 text-primary" />
                <h3 className="font-display text-2xl text-foreground">Uploaded Text</h3>
              </div>
              <pre className="prose-literary mt-4 whitespace-pre-wrap text-foreground/90">{book.extracted_text}</pre>
            </>
          ) : (
            <p className="font-ui text-sm text-muted-foreground">
              This book has no foreword. Open a chapter from the table of contents.
            </p>
          )}

          {book.afterword ? (
            <>
              <Separator className="my-8" />
              <h3 className="font-display text-2xl text-foreground">Afterword</h3>
              <div className="reader-html prose-literary mt-4 text-foreground/90" dangerouslySetInnerHTML={{ __html: book.afterword }} />
            </>
          ) : null}
        </article>
      </section>
    </div>
  );
};

export default ReaderBookDetailPage;
