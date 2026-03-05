import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileText, PenLine, Search, UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { fetchPublicAuthors, resolveMediaUrl } from "@/lib/api";
import { authorProfilePath } from "@/lib/authors";

const PublicAuthorsPage = () => {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const authorsQuery = useQuery({
    queryKey: ["public-authors", page, search],
    queryFn: () =>
      fetchPublicAuthors({
        page,
        q: search,
      }),
  });

  const authors = authorsQuery.data?.results || [];

  return (
    <div>
      <div className="border-b border-border/30 bg-muted/20 py-10 md:py-14">
        <div className="container mx-auto px-4 sm:px-6">
          <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">
            {t("authors.title", "Authors")}
          </h1>
          <p className="mt-2 font-ui text-base text-muted-foreground max-w-lg">
            {t("authors.subtitle", "Browse all authors and open their published works.")}
          </p>

          <div className="relative mt-6 w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("authors.searchPlaceholder", "Search by name or username...")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-12 pr-4 font-ui h-14 text-base rounded-xl bg-background border-border/60 focus:border-primary/40 shadow-sm transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 md:py-10">
        {authorsQuery.isLoading ? (
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl border bg-card shadow-card overflow-hidden animate-pulse p-4 space-y-3">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-7 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : authorsQuery.isError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full mb-5 bg-muted/40">
              <UserRound className="h-9 w-9 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground">
              {t("authors.noneFoundTitle", "No authors found")}
            </h3>
            <p className="mt-2 font-body text-sm text-muted-foreground max-w-xs">
              {t("authors.noneFoundDesc", "Try changing your search query.")}
            </p>
          </div>
        ) : authors.length > 0 ? (
          <>
            <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {authors.map((author) => {
                const profilePhoto = resolveMediaUrl(author.profile_photo);
                const fallback = author.display_name?.charAt(0)?.toUpperCase() || "?";
                return (
                  <Link key={author.key} to={authorProfilePath(author.key)} className="block h-full">
                    <article className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/40">
                          {profilePhoto ? (
                            <img src={profilePhoto} alt={author.display_name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="font-ui text-xs font-semibold text-muted-foreground">{fallback}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate font-display text-lg font-semibold text-foreground">
                            {author.display_name}
                          </h2>
                          <p className="truncate font-ui text-xs text-muted-foreground">
                            {author.username ? `@${author.username}` : t("authors.anonymous", "Anonymous")}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                        <div className="rounded-md border border-border/50 bg-muted/20 px-1.5 py-1.5">
                          <BookOpen className="mx-auto h-3 w-3 text-muted-foreground" />
                          <p className="mt-1 font-ui text-[11px] text-muted-foreground">{author.books_count}</p>
                        </div>
                        <div className="rounded-md border border-border/50 bg-muted/20 px-1.5 py-1.5">
                          <FileText className="mx-auto h-3 w-3 text-muted-foreground" />
                          <p className="mt-1 font-ui text-[11px] text-muted-foreground">{author.stories_count}</p>
                        </div>
                        <div className="rounded-md border border-border/50 bg-muted/20 px-1.5 py-1.5">
                          <PenLine className="mx-auto h-3 w-3 text-muted-foreground" />
                          <p className="mt-1 font-ui text-[11px] text-muted-foreground">{author.poems_count}</p>
                        </div>
                      </div>

                      <p className="mt-3 font-ui text-xs text-muted-foreground">
                        {t("authors.totalWorks", "{count} works").replace("{count}", String(author.works_count))}
                      </p>
                    </article>
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <p className="font-ui text-xs text-muted-foreground">
                {t("authors.totalAuthors", "Total: {count}").replace("{count}", String(authorsQuery.data?.count || 0))}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
                  {t("pagination.prev", "Previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!authorsQuery.data?.next}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  {t("pagination.next", "Next")}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full mb-5 bg-muted/40">
              <UserRound className="h-9 w-9 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground">
              {t("authors.noneFoundTitle", "No authors found")}
            </h3>
            <p className="mt-2 font-body text-sm text-muted-foreground max-w-xs">
              {t("authors.noneFoundDesc", "Try changing your search query.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicAuthorsPage;
