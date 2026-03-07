import { useI18n } from "@/i18n";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  Feather,
  FileText,
  Filter,
  Send,
  PlusSquare,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  cleanupRecycleBin,
  deleteContentItem,
  fetchContent,
  hardDeleteContentItem,
  restoreContentItem,
  submitContentForReview,
} from "@/lib/api";
import { CONTENT_STATUS_STYLES } from "@/lib/content";
import { useSession } from "@/hooks/useSession";
import { toast } from "@/hooks/use-toast";
import type { ContentStatus } from "@/lib/types";

type WriterWorkCategory = "books" | "poems" | "stories";

const categories: WriterWorkCategory[] = ["books", "poems", "stories"];

const categoryIcons = {
  books: <BookOpen className="h-4 w-4" />,
  poems: <Feather className="h-4 w-4" />,
  stories: <FileText className="h-4 w-4" />,
};

const statusOptionValues: Array<{ labelKey: string; value: "all" | ContentStatus }> = [
  { labelKey: "myWorks.allStatuses", value: "all" },
  { labelKey: "myWorks.statusDraft", value: "draft" },
  { labelKey: "myWorks.statusApproved", value: "approved" },
  { labelKey: "myWorks.statusRejected", value: "rejected" },
];

function getEditPath(category: WriterWorkCategory, id: number): string {
  if (category === "books") return `/writer/books/${id}/edit`;
  if (category === "poems") return `/writer/poems/${id}/edit`;
  return `/writer/stories/${id}/edit`;
}

function getReadPath(category: WriterWorkCategory, id: number): string {
  if (category === "books") return `/books/${id}`;
  if (category === "poems") return `/poems/${id}`;
  return `/stories/${id}`;
}

function parseCategory(value: string | null): WriterWorkCategory {
  if (value && categories.includes(value as WriterWorkCategory)) {
    return value as WriterWorkCategory;
  }
  return "books";
}

const MyWorksPage = () => {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const { me } = useSession();
  const [searchParams] = useSearchParams();

  const [category, setCategory] = useState<WriterWorkCategory>(parseCategory(searchParams.get("cat")));
  const [status, setStatus] = useState<"all" | ContentStatus>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [isCleaningBin, setIsCleaningBin] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(searchParams.get("bin") === "1");

  useEffect(() => {
    setCategory(parseCategory(searchParams.get("cat")));
    setShowRecycleBin(searchParams.get("bin") === "1");
    setPage(1);
  }, [searchParams]);

  const worksQuery = useQuery({
    queryKey: ["my-works", category, showRecycleBin, status, search, dateFrom, dateTo, page],
    queryFn: () =>
      fetchContent(category, {
        mine: true,
        deleted: showRecycleBin,
        status: status === "all" ? undefined : status,
        q: search,
        date_from: dateFrom,
        date_to: dateTo,
        page,
        requiresAuth: true,
      }),
  });

  const canPrev = page > 1;
  const canNext = Boolean(worksQuery.data?.next);

  const handleDelete = async (id: number) => {
    if (showRecycleBin) {
      const shouldDeleteForever = await confirm({
        title: t("myWorks.deleteForeverConfirm"),
        description: t("myWorks.deleteForeverDesc"),
        destructive: true,
        confirmText: t("myWorks.deleteForever"),
      });
      if (!shouldDeleteForever) return;

      setDeletingId(id);
      try {
        await hardDeleteContentItem(category, id);
        worksQuery.refetch();
        toast({ title: t("myWorks.deletedForeverDone") });
      } catch {
        toast({ variant: "destructive", title: t("work.deleteFailed") });
      } finally {
        setDeletingId(null);
      }
      return;
    }

    const isConfirmed = await confirm({
      title: t("myWorks.moveToBinConfirm"),
      description: t("myWorks.moveToBinDesc"),
      destructive: true,
      confirmText: t("myWorks.moveToBin"),
    });
    if (!isConfirmed) return;

    setDeletingId(id);
    try {
      await deleteContentItem(category, id);
      worksQuery.refetch();
      toast({ title: t("myWorks.movedToBin") });
    } catch {
      toast({ variant: "destructive", title: t("work.deleteFailed") });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (id: number) => {
    setRestoringId(id);
    try {
      await restoreContentItem(category, id);
      worksQuery.refetch();
      toast({ title: t("myWorks.restored") });
    } catch {
      toast({ variant: "destructive", title: t("myWorks.restoreFailed") });
    } finally {
      setRestoringId(null);
    }
  };

  const handleCleanupBin = async () => {
    const isConfirmed = await confirm({
      title: t("myWorks.cleanUpConfirm"),
      description: t("myWorks.cleanUpDesc"),
      destructive: true,
      confirmText: t("myWorks.cleanUp"),
    });
    if (!isConfirmed) return;

    setIsCleaningBin(true);
    try {
      const result = await cleanupRecycleBin(category);
      worksQuery.refetch();
      toast({ title: t("myWorks.cleanedUp").replace("{count}", String(result.deleted_count || 0)) });
    } catch {
      toast({ variant: "destructive", title: t("work.deleteFailed") });
    } finally {
      setIsCleaningBin(false);
    }
  };

  const handlePublish = async (id: number) => {
    const isConfirmed = await confirm({
      title: t("publish.button", "Publish"),
      description: t(
        "publish.confirmDescription",
        "This will be sent to a redactor for approval.",
      ),
      confirmText: t("publish.send", "Send"),
      cancelText: t("publish.cancel", "Decline"),
    });
    if (!isConfirmed) return;

    setPublishingId(id);
    try {
      await submitContentForReview(category, id);
      worksQuery.refetch();
      toast({ title: t("publish.sent", "Sent to redactor for approval.") });
    } catch (error) {
      toast({
        variant: "destructive",
        title: error instanceof Error ? error.message : t("publish.failed", "Failed to send to redactor."),
      });
    } finally {
      setPublishingId(null);
    }
  };

  const hasActiveFilters = status !== "all" || search || dateFrom || dateTo;

  return (
    <div className="container mx-auto space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">{t("work.myWorks")}</h1>
          <p className="mt-1 font-ui text-sm text-muted-foreground">{t("writer.filterSub")}</p>
        </div>
        {me?.is_writer_approved && (
          <div className="flex items-center gap-2">
            {showRecycleBin && (
              <Button
                variant="destructive"
                className="gap-2 h-11"
                onClick={handleCleanupBin}
                disabled={isCleaningBin || worksQuery.isLoading || (worksQuery.data?.count || 0) === 0}
              >
                <Trash2 className="h-4 w-4" />
                {t("myWorks.cleanUp")}
              </Button>
            )}
            <Link to="/writer/new">
              <Button className="gap-2 h-11">
                <PlusSquare className="h-4 w-4" />
                {t("work.newWork")}
              </Button>
            </Link>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setCategory(cat);
              setPage(1);
            }}
            className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 font-ui text-sm font-medium transition-all ${
              category === cat
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 bg-background/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            <span>{categoryIcons[cat]}</span>
            <span className="capitalize">{t(`work.${cat}`)}</span>
            {category === cat && worksQuery.data && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-xs">{worksQuery.data.count}</span>
            )}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            setShowRecycleBin((prev) => !prev);
            setPage(1);
          }}
          className={`ml-0 sm:ml-2 flex items-center gap-2 rounded-full border-2 px-4 py-2 font-ui text-sm font-medium transition-all ${
            showRecycleBin
              ? "border-red-500/60 bg-red-500/10 text-red-700"
              : "border-border/60 bg-background/60 text-muted-foreground hover:border-red-400/40 hover:text-foreground"
          }`}
        >
          <Archive className="h-4 w-4" />
          <span>{t("myWorks.recycleBin")}</span>
        </button>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-card">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("work.titleOrText")}
              className="h-11 pl-9 font-ui"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className={`h-11 gap-2 font-ui ${hasActiveFilters ? "border-primary text-primary" : ""}`}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">{t("myWorks.filters")}</span>
            {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-primary" />}
            {filtersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>

        {filtersOpen && (
          <div className="mt-4 grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="font-ui text-sm font-medium">{t("work.status")}</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as typeof status);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 font-ui">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptionValues.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {t(item.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-ui text-sm font-medium">{t("work.fromDate")}</Label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10 pl-9 font-ui"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-ui text-sm font-medium">{t("work.toDate")}</Label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-10 pl-9 font-ui"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                className="font-ui text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={() => {
                  setStatus("all");
                  setSearch("");
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
              >
                {t("myWorks.clearAll")}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        {worksQuery.isLoading && (
          <div className="rounded-xl border border-border/70 bg-card/80 p-6 text-center">
            <p className="font-ui text-sm text-muted-foreground animate-pulse">{t("writer.loading")}</p>
          </div>
        )}

        {!worksQuery.isLoading && worksQuery.data?.results?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/65 p-12 text-center">
            <span className="text-5xl inline-flex items-center justify-center">
              {showRecycleBin ? <Archive className="h-8 w-8" /> : categoryIcons[category]}
            </span>
            <p className="mt-4 font-display text-lg font-medium text-foreground">{t("work.noneFound")}</p>
            <p className="mt-1 font-ui text-sm text-muted-foreground">
              {hasActiveFilters
                ? t("myWorks.noWorksHint")
                : showRecycleBin
                ? t("myWorks.emptyRecycleBin")
                : t("myWorks.noWorksYet").replace("{category}", t(`work.${category}`))}
            </p>
            {!hasActiveFilters && !showRecycleBin && me?.is_writer_approved && (
              <Link to="/writer/new">
                <Button className="mt-4 gap-2">
                  <PlusSquare className="h-4 w-4" />
                  {t("myWorks.createFirst").replace("{type}", t(`work.${category}`))}
                </Button>
              </Link>
            )}
          </div>
        )}

        {worksQuery.data?.results?.map((item) => {
          const readPath = getReadPath(category, item.id);
          const isDeleting = deletingId === item.id;
          const isRestoring = restoringId === item.id;
          const isPublishing = publishingId === item.id;
          const canPublish =
            !showRecycleBin &&
            item.status !== "approved" &&
            !item.is_submitted_for_review;

          return (
            <div
              key={item.id}
              className="group rounded-xl border border-border/70 bg-card/80 p-5 shadow-card transition-all hover:border-border hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl">
                    {showRecycleBin ? <Archive className="h-5 w-5" /> : categoryIcons[category]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold text-foreground truncate">{item.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-ui text-xs font-medium capitalize ${CONTENT_STATUS_STYLES[item.status]}`}
                      >
                        {t(`myWorks.status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`, item.status)}
                      </span>
                      {item.is_submitted_for_review && item.status === "draft" && (
                        <Badge
                          variant="outline"
                          className="border-sky-500/50 bg-sky-500/10 text-sky-700 text-[10px] uppercase tracking-wider"
                        >
                          {t("myWorks.sentToRedactor", "Sent to redactor")}
                        </Badge>
                      )}
                      {item.is_deleted && (
                        <Badge
                          variant="outline"
                          className="border-red-500/50 bg-red-500/10 text-red-700 text-[10px] uppercase tracking-wider"
                        >
                          {t("myWorks.deleted")}
                        </Badge>
                      )}
                      {item.is_hidden && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 bg-amber-500/10 text-amber-700 text-[10px] uppercase tracking-wider"
                        >
                          {t("myWorks.hidden")}
                        </Badge>
                      )}
                      <span className="font-ui text-xs text-muted-foreground">
                        {t("myWorks.created")} {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      {item.deleted_at && (
                        <span className="font-ui text-xs text-muted-foreground">
                          {t("myWorks.deletedOn")} {new Date(item.deleted_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {me?.is_writer_approved && (
                  <div className="flex shrink-0 items-center gap-2">
                    {!showRecycleBin && (
                      <>
                        {canPublish && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 gap-1.5 font-ui"
                            disabled={isPublishing || isDeleting || isRestoring}
                            onClick={() => handlePublish(item.id)}
                          >
                            {isPublishing ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            <span>{t("publish.button", "Publish")}</span>
                          </Button>
                        )}
                        <a href={readPath} target="_blank" rel="noreferrer">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 gap-1.5 font-ui text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="hidden sm:inline">{t("myWorks.view")}</span>
                          </Button>
                        </a>
                        <Link to={getEditPath(category, item.id)}>
                          <Button variant="outline" size="sm" className="h-9 gap-1.5 font-ui">
                            <Edit3 className="h-4 w-4" />
                            <span className="hidden sm:inline">{t("work.openEditor")}</span>
                          </Button>
                        </Link>
                      </>
                    )}

                    {showRecycleBin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 font-ui"
                        disabled={isRestoring || isDeleting}
                        onClick={() => handleRestore(item.id)}
                      >
                        {isRestoring ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">{t("myWorks.restore")}</span>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-9 ${showRecycleBin ? "px-3 gap-1.5 w-auto text-red-700 hover:text-red-800 hover:bg-red-100" : "w-9 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"}`}
                      disabled={isDeleting || isRestoring}
                      onClick={() => handleDelete(item.id)}
                    >
                      {isDeleting ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          {showRecycleBin && <span className="hidden sm:inline">{t("myWorks.deleteForever")}</span>}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {item.description && (
                <p className="mt-3 font-ui text-sm text-muted-foreground line-clamp-2 pl-13">{item.description}</p>
              )}

              {item.rejection_reason && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/35 bg-red-500/10 p-3">
                  <span className="text-sm">!</span>
                  <p className="font-ui text-sm text-red-700">
                    <strong>{t("myWorks.rejected")}</strong> {item.rejection_reason}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {(canPrev || canNext) && (
        <div className="flex items-center justify-between">
          <p className="font-ui text-xs text-muted-foreground">{t("admin.total")}: {worksQuery.data?.count || 0}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setPage((p) => p - 1)}
              disabled={!canPrev}
            >
              {t("myWorks.previous")}
            </Button>
            <span className="flex h-9 items-center px-3 font-ui text-sm text-muted-foreground">
              {t("myWorks.page").replace("{page}", String(page))}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setPage((p) => p + 1)}
              disabled={!canNext}
            >
              {t("myWorks.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyWorksPage;
