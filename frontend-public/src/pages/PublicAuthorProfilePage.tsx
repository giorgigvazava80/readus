import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowUpDown, BookOpen, Check, Copy, FileText, PenLine, Search, UserRound } from "lucide-react";

import CategoryFilter, { type PublicBrowseCategory } from "@/components/CategoryFilter";
import FollowAuthorButton from "@/components/FollowAuthorButton";
import type { PublicWorkCardItem } from "@/components/WorkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/hooks/useSession";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { authorProfilePath, resolveAuthorKey } from "@/lib/authors";
import { fetchContent, fetchPublicAuthorDetail, resolveMediaUrl } from "@/lib/api";
import type { ContentItem, PaginatedResponse } from "@/lib/types";

const CATEGORY_COLOR_PALETTE: Record<"books" | "stories" | "poems", string[]> = {
  books: ["hsl(24, 60%, 55%)", "hsl(32, 50%, 48%)", "hsl(14, 55%, 52%)"],
  stories: ["hsl(215, 40%, 45%)", "hsl(228, 35%, 50%)", "hsl(200, 45%, 42%)"],
  poems: ["hsl(150, 25%, 45%)", "hsl(165, 30%, 40%)", "hsl(135, 20%, 50%)"],
};

type AuthorWorkCategory = "books" | "stories" | "poems";
type AuthorSort = "newest" | "oldest" | "title";

function parseNextPage(next: string | null): number | undefined {
  if (!next) return undefined;

  try {
    const url = new URL(next, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const value = Number(url.searchParams.get("page"));
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function toExcerpt(item: ContentItem): string {
  const rawHtml = item.description || item.extracted_text || item.body || "";
  const raw = rawHtml.replace(/<[^>]*>?/gm, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= 190) return raw;
  return `${raw.slice(0, 187)}...`;
}

function estimateReadTime(item: ContentItem, readTimeTemplate: string): string {
  const text = [item.body, item.extracted_text, item.description].filter(Boolean).join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return readTimeTemplate.replace("{minutes}", String(minutes));
}

function colorFor(category: "books" | "stories" | "poems", id: number): string {
  const palette = CATEGORY_COLOR_PALETTE[category];
  return palette[id % palette.length];
}

function toCardItem(
  category: "books" | "stories" | "poems",
  item: ContentItem,
  locale: string,
  excerptFallback: string,
  readTimeTemplate: string,
): PublicWorkCardItem {
  const excerpt = toExcerpt(item) || excerptFallback;

  return {
    id: item.id,
    publicSlug: item.public_slug || String(item.id),
    category,
    title: item.title,
    author: item.author_name || item.author_username || "",
    authorKey: resolveAuthorKey(item),
    excerpt,
    coverColor: colorFor(category, item.id),
    coverImageUrl: resolveMediaUrl(item.cover_image),
    date: new Date(item.created_at).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    readTime: estimateReadTime(item, readTimeTemplate),
    createdAt: item.created_at,
    isHidden: item.is_hidden,
  };
}

function flattenPages<T>(pages: PaginatedResponse<T>[] | undefined): T[] {
  if (!pages?.length) return [];
  return pages.flatMap((page) => page.results);
}

const PublicAuthorProfilePage = () => {
  const { t, language } = useI18n();
  const { me } = useSession();
  const { authorKey: rawAuthorKey } = useParams();
  const [category, setCategory] = useState<PublicBrowseCategory>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AuthorSort>("newest");
  const [copied, setCopied] = useState(false);

  const locale = language === "ka" ? "ka-GE" : "en-US";
  const excerptFallback = t("home.excerptUnavailable", "Excerpt is not available yet.");
  const readTimeTemplate = t("home.readTime", "{minutes} min read");

  const authorKey = useMemo(() => {
    if (!rawAuthorKey) return "";
    try {
      return decodeURIComponent(rawAuthorKey).trim();
    } catch {
      return rawAuthorKey.trim();
    }
  }, [rawAuthorKey]);

  const authorQuery = useQuery({
    queryKey: ["public-author", authorKey],
    queryFn: () => fetchPublicAuthorDetail(authorKey),
    enabled: Boolean(authorKey),
  });

  const booksQuery = useInfiniteQuery({
    queryKey: ["public-author-works", authorKey, "books"],
    queryFn: ({ pageParam }) =>
      fetchContent("books", { status: "approved", page: Number(pageParam), author: authorKey }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => parseNextPage(lastPage.next),
    enabled: Boolean(authorKey),
  });

  const storiesQuery = useInfiniteQuery({
    queryKey: ["public-author-works", authorKey, "stories"],
    queryFn: ({ pageParam }) =>
      fetchContent("stories", { status: "approved", page: Number(pageParam), author: authorKey }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => parseNextPage(lastPage.next),
    enabled: Boolean(authorKey),
  });

  const poemsQuery = useInfiniteQuery({
    queryKey: ["public-author-works", authorKey, "poems"],
    queryFn: ({ pageParam }) =>
      fetchContent("poems", { status: "approved", page: Number(pageParam), author: authorKey }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => parseNextPage(lastPage.next),
    enabled: Boolean(authorKey),
  });

  const allWorks = useMemo(() => {
    const books = flattenPages(booksQuery.data?.pages).map((item) =>
      toCardItem("books", item, locale, excerptFallback, readTimeTemplate),
    );
    const stories = flattenPages(storiesQuery.data?.pages).map((item) =>
      toCardItem("stories", item, locale, excerptFallback, readTimeTemplate),
    );
    const poems = flattenPages(poemsQuery.data?.pages).map((item) =>
      toCardItem("poems", item, locale, excerptFallback, readTimeTemplate),
    );

    return [...books, ...stories, ...poems];
  }, [
    booksQuery.data?.pages,
    storiesQuery.data?.pages,
    poemsQuery.data?.pages,
    locale,
    excerptFallback,
    readTimeTemplate,
  ]);

  const loadedByCategory = useMemo(
    () => ({
      books: flattenPages(booksQuery.data?.pages).length,
      stories: flattenPages(storiesQuery.data?.pages).length,
      poems: flattenPages(poemsQuery.data?.pages).length,
    }),
    [booksQuery.data?.pages, storiesQuery.data?.pages, poemsQuery.data?.pages],
  );

  const loadedTotal = loadedByCategory.books + loadedByCategory.stories + loadedByCategory.poems;

  const isWorksLoading = booksQuery.isLoading || storiesQuery.isLoading || poemsQuery.isLoading;
  const isWorksError = booksQuery.isError || storiesQuery.isError || poemsQuery.isError;

  const hasMore = useMemo(() => {
    if (category === "books") return Boolean(booksQuery.hasNextPage);
    if (category === "stories") return Boolean(storiesQuery.hasNextPage);
    if (category === "poems") return Boolean(poemsQuery.hasNextPage);
    return Boolean(booksQuery.hasNextPage || storiesQuery.hasNextPage || poemsQuery.hasNextPage);
  }, [category, booksQuery.hasNextPage, storiesQuery.hasNextPage, poemsQuery.hasNextPage]);

  const isFetchingMore = useMemo(() => {
    if (category === "books") return booksQuery.isFetchingNextPage;
    if (category === "stories") return storiesQuery.isFetchingNextPage;
    if (category === "poems") return poemsQuery.isFetchingNextPage;
    return booksQuery.isFetchingNextPage || storiesQuery.isFetchingNextPage || poemsQuery.isFetchingNextPage;
  }, [
    category,
    booksQuery.isFetchingNextPage,
    storiesQuery.isFetchingNextPage,
    poemsQuery.isFetchingNextPage,
  ]);

  const sortOptions: Array<{ value: AuthorSort; labelKey: string; fallback: string }> = [
    { value: "newest", labelKey: "authors.sortNewest", fallback: "Newest first" },
    { value: "oldest", labelKey: "authors.sortOldest", fallback: "Oldest first" },
    { value: "title", labelKey: "authors.sortTitle", fallback: "Title A-Z" },
  ];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const visibleWorks = allWorks.filter((item) => {
      const matchCategory = category === "all" || item.category === category;
      const text = `${item.title} ${item.author} ${item.excerpt}`.toLowerCase();
      const matchSearch = !term || text.includes(term);
      return matchCategory && matchSearch;
    });

    const sorted = [...visibleWorks];

    if (sort === "newest") {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === "oldest") {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      sorted.sort((a, b) => a.title.localeCompare(b.title, locale));
    }

    return sorted;
  }, [allWorks, category, search, sort, locale]);

  const handleLoadMore = async () => {
    if (!hasMore || isFetchingMore) return;

    if (category === "books") {
      await booksQuery.fetchNextPage();
      return;
    }

    if (category === "stories") {
      await storiesQuery.fetchNextPage();
      return;
    }

    if (category === "poems") {
      await poemsQuery.fetchNextPage();
      return;
    }

    const jobs: Array<Promise<unknown>> = [];
    if (booksQuery.hasNextPage) jobs.push(booksQuery.fetchNextPage());
    if (storiesQuery.hasNextPage) jobs.push(storiesQuery.fetchNextPage());
    if (poemsQuery.hasNextPage) jobs.push(poemsQuery.fetchNextPage());

    if (jobs.length > 0) {
      await Promise.all(jobs);
    }
  };

  const handleCopyProfileLink = async () => {
    const profilePath = authorProfilePath(authorKey || "anonymous");
    const profileUrl = typeof window !== "undefined" ? `${window.location.origin}${profilePath}` : profilePath;

    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast({ title: t("authors.linkCopied", "Profile link copied") });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ variant: "destructive", title: t("authors.linkCopyFailed", "Could not copy profile link") });
    }
  };

  if (!authorKey) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {t("authors.notFoundTitle", "Author not found")}
        </h1>
        <p className="mt-2 font-ui text-sm text-muted-foreground">
          {t("authors.notFoundDesc", "This author does not exist or has no public works.")}
        </p>
        <Link to="/authors" className="inline-block mt-4 font-ui text-sm text-primary hover:underline">
          {t("authors.backToAuthors", "Back to authors")}
        </Link>
      </div>
    );
  }

  if (authorQuery.isLoading || isWorksLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-20 text-center font-ui text-sm text-muted-foreground">
        {t("common.loading", "Loading...")}
      </div>
    );
  }

  if (authorQuery.isError || !authorQuery.data) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {t("authors.notFoundTitle", "Author not found")}
        </h1>
        <p className="mt-2 font-ui text-sm text-muted-foreground">
          {t("authors.notFoundDesc", "This author does not exist or has no public works.")}
        </p>
        <Link to="/authors" className="inline-block mt-4 font-ui text-sm text-primary hover:underline">
          {t("authors.backToAuthors", "Back to authors")}
        </Link>
      </div>
    );
  }

  if (isWorksError) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {t("browse.noneFoundTitle", "No works found")}
        </h1>
        <p className="mt-2 font-ui text-sm text-muted-foreground">
          {t("browse.noneFoundDesc", "Try changing your search or selected category.")}
        </p>
      </div>
    );
  }

  const author = authorQuery.data;
  const profilePhoto = resolveMediaUrl(author.profile_photo);
  const authorUsername = author.username ? `@${author.username}` : t("authors.anonymous", "Anonymous");
  const canFollow = Boolean(me && author.id && me.id !== author.id && !author.is_anonymous);
  const totalKnownWorks = author.works_count || loadedTotal;
  const categoryStats: Array<{
    key: AuthorWorkCategory;
    count: number;
    icon: typeof BookOpen;
    label: string;
  }> = [
    { key: "books", count: author.books_count, icon: BookOpen, label: t("category.books", "Books") },
    { key: "stories", count: author.stories_count, icon: FileText, label: t("category.stories", "Stories") },
    { key: "poems", count: author.poems_count, icon: PenLine, label: t("category.poems", "Poetry") },
  ];

  return (
    <div>
      <div className="border-b border-border/30 bg-muted/20 py-10 md:py-14">
        <div className="container mx-auto px-4 sm:px-6">
          <Link to="/authors" className="inline-flex items-center font-ui text-sm text-primary hover:underline">
            {t("authors.backToAuthors", "Back to authors")}
          </Link>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/40">
                {profilePhoto ? (
                  <img src={profilePhoto} alt={author.display_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-ui text-lg font-semibold text-muted-foreground">
                    {author.display_name?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                )}
              </div>

              <div>
                <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">
                  {author.display_name}
                </h1>
                <p className="mt-1 inline-flex items-center gap-1 font-ui text-sm text-muted-foreground">
                  {author.is_anonymous ? <UserRound className="h-4 w-4" /> : null}
                  {authorUsername}
                </p>
                <p className="mt-1 font-ui text-sm text-muted-foreground">
                  {t("authors.totalWorks", "{count} works").replace("{count}", String(author.works_count))}
                </p>
                {!author.is_anonymous ? (
                  <p className="font-ui text-sm text-muted-foreground">
                    Followers: {author.follower_count || 0}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              {canFollow ? (
                <FollowAuthorButton authorId={author.id} className="w-full md:w-auto" size="default" />
              ) : null}
              <Button type="button" variant="outline" className="w-full md:w-auto" onClick={handleCopyProfileLink}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied
                  ? t("authors.linkCopied", "Profile link copied")
                  : t("authors.shareProfile", "Copy profile link")}
              </Button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            {categoryStats.map((stat) => (
              <button
                key={stat.key}
                type="button"
                onClick={() => setCategory(stat.key)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  category === stat.key
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/60 bg-background hover:border-primary/30"
                }`}
              >
                <p className="font-ui text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                <p className="mt-1 flex items-center gap-1.5 font-display text-lg font-semibold text-foreground sm:gap-2 sm:text-2xl">
                  <stat.icon className="h-5 w-5 text-primary/70" />
                  {stat.count}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="relative">
              <label htmlFor="author-works-search" className="sr-only">
                {t("authors.searchWorksLabel", "Search this author's works")}
              </label>
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="author-works-search"
                placeholder={t("authors.searchWorksPlaceholder", "Search this author's works...")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-12 pr-4 font-ui h-14 text-base rounded-xl bg-background border-border/60 focus:border-primary/40 shadow-sm transition-colors"
              />
            </div>

            <Select value={sort} onValueChange={(value) => setSort(value as AuthorSort)}>
              <SelectTrigger className="h-14 font-ui">
                <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey, option.fallback)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CategoryFilter active={category} onChange={setCategory} />

            <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-ui font-medium text-muted-foreground border border-border/50 bg-muted/30">
                {t("authors.showingResults", "Showing {count} results").replace("{count}", String(filtered.length))}
              </span>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-ui font-medium text-muted-foreground border border-border/50 bg-muted/30">
                {t("authors.showingLoadedOfTotal", "Showing {loaded} of {total} works")
                  .replace("{loaded}", String(loadedTotal))
                  .replace("{total}", String(totalKnownWorks))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 md:py-10">
        {filtered.length > 0 ? (
          <>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((work) => (
                <Link
                  key={`${work.category}-${work.id}`}
                  to={`/read/${work.category}/${work.publicSlug}`}
                  className="group rounded-lg border border-border/60 bg-card p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <article className="flex gap-3">
                    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md border border-border/40 bg-muted/20 sm:h-28 sm:w-20">
                      {work.coverImageUrl ? (
                        <img
                          src={work.coverImageUrl}
                          alt={work.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="absolute inset-0"
                          style={{ background: `linear-gradient(160deg, ${work.coverColor}cc, ${work.coverColor})` }}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-ui text-[10px] uppercase tracking-wide text-muted-foreground">
                        {work.category === "books"
                          ? t("category.book", "Book")
                          : work.category === "stories"
                            ? t("category.story", "Story")
                            : t("category.poem", "Poem")}
                      </p>
                      <h3 className="mt-0.5 line-clamp-2 font-display text-sm font-semibold leading-tight text-foreground sm:text-base">
                        {work.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 font-ui text-xs leading-relaxed text-muted-foreground">
                        {work.excerpt}
                      </p>
                      <div className="mt-2 flex items-center gap-2 font-ui text-[11px] text-muted-foreground">
                        <span>{work.readTime}</span>
                        <span>•</span>
                        <span>{work.date}</span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            {hasMore ? (
              <div className="mt-8 flex justify-center">
                <Button type="button" variant="outline" onClick={handleLoadMore} disabled={isFetchingMore}>
                  {isFetchingMore
                    ? t("authors.loadingMore", "Loading more...")
                    : t("authors.loadMoreWorks", "Load more works")}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full mb-5 bg-muted/40">
              <BookOpen className="h-9 w-9 text-primary/60" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground">
              {t("browse.noneFoundTitle", "No works found")}
            </h3>
            <p className="mt-2 font-body text-sm text-muted-foreground max-w-xs">
              {t("browse.noneFoundDesc", "Try changing your search or selected category.")}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-4"
              onClick={() => {
                setSearch("");
                setCategory("all");
                setSort("newest");
              }}
            >
              {t("authors.clearFilters", "Clear filters")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicAuthorProfilePage;
