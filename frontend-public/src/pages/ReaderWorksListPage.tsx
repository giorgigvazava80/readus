import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchContent } from "@/lib/api";
import { estimateReadTimeFromHtml, toExcerpt } from "@/lib/content";
import type { ContentCategory } from "@/lib/types";

interface ReaderWorksListPageProps {
  category: Extract<ContentCategory, "books" | "poems" | "stories">;
}

const titles = {
  books: "Books",
  poems: "Poems",
  stories: "Stories",
};

const paths = {
  books: "/books",
  poems: "/poems",
  stories: "/stories",
};

const ReaderWorksListPage = ({ category }: ReaderWorksListPageProps) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const worksQuery = useQuery({
    queryKey: ["reader", category, page, search],
    queryFn: () =>
      fetchContent(category, {
        status: "approved",
        q: search,
        page,
      }),
  });

  const items = useMemo(() => worksQuery.data?.results || [], [worksQuery.data?.results]);

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <h1 className="font-display text-4xl font-semibold text-foreground">{titles[category]}</h1>
        <p className="mt-2 font-body text-base text-muted-foreground">
          Approved works optimized for reading.
        </p>

        <div className="mt-5 relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={`Search ${titles[category].toLowerCase()}...`}
            className="pl-9 font-ui"
          />
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {worksQuery.isLoading ? <p className="font-ui text-sm text-muted-foreground">Loading...</p> : null}

        {!worksQuery.isLoading && !items.length ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/65 p-6 font-ui text-sm text-muted-foreground">
            No published works found.
          </div>
        ) : null}

        {items.map((item) => (
          <Link key={item.id} to={`${paths[category]}/${item.public_slug || item.id}`} className="group block">
            <article className="rounded-xl border border-border/70 bg-card/85 p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-2xl font-semibold text-foreground transition-colors group-hover:text-primary">
                  {item.title}
                </p>
                {item.is_hidden && (
                  <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 text-[10px] uppercase tracking-wider">
                    Hidden
                  </Badge>
                )}
              </div>
              <p className="mt-1 font-ui text-sm text-muted-foreground">
                by {item.author_name || item.author_username || "Unknown author"}
              </p>
              <p className="mt-3 font-body text-sm leading-relaxed text-foreground/80">
                {toExcerpt(item.body || item.extracted_text || item.description)}
              </p>
              <div className="mt-4 flex items-center justify-between font-ui text-xs text-muted-foreground">
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                <span>{estimateReadTimeFromHtml(item.body || item.extracted_text || item.description)}</span>
              </div>
            </article>
          </Link>
        ))}
      </section>

      <section className="flex items-center justify-between">
        <p className="font-ui text-xs text-muted-foreground">Total: {worksQuery.data?.count || 0}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!worksQuery.data?.next}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ReaderWorksListPage;
