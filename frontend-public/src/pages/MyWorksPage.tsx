import { useI18n } from "@/i18n";
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  Feather,
  FileText,
  Filter,
  PlusSquare,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { fetchContent, deleteContentItem } from "@/lib/api";
import { CONTENT_STATUS_STYLES } from "@/lib/content";
import { useSession } from "@/hooks/useSession";
import { toast } from "@/hooks/use-toast";
import type { ContentCategory, ContentStatus } from "@/lib/types";

const categories: ContentCategory[] = ["books", "poems", "stories"];

const categoryIcons: Record<string, React.ReactNode> = {
  books: <BookOpen className="h-4 w-4" />,
  poems: <Feather className="h-4 w-4" />,
  stories: <PlusSquare className="h-4 w-4" />,
};

const categoryEmojis: Record<string, string> = {
  books: "📚",
  poems: "🖋️",
  stories: "📝",
};

// Status options labels resolved at render time via t()
const statusOptionValues: Array<{ labelKey: string; value: "all" | ContentStatus }> = [
  { labelKey: "myWorks.allStatuses", value: "all" },
  { labelKey: "myWorks.statusDraft", value: "draft" },
  { labelKey: "myWorks.statusApproved", value: "approved" },
  { labelKey: "myWorks.statusRejected", value: "rejected" },
];

function getEditPath(category: ContentCategory, id: number): string {
  if (category === "books") return `/writer/books/${id}/edit`;
  if (category === "chapters") return `/writer/chapters/${id}/edit`;
  if (category === "poems") return `/writer/poems/${id}/edit`;
  return `/writer/stories/${id}/edit`;
}

function getReadPath(category: ContentCategory, id: number): string | null {
  if (category === "books") return `/books/${id}`;
  if (category === "poems") return `/poems/${id}`;
  if (category === "stories") return `/stories/${id}`;
  return null;
}

const MyWorksPage = () => {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const { me } = useSession();
  const [searchParams] = useSearchParams();

  const [category, setCategory] = useState<ContentCategory>(
    (searchParams.get("cat") as ContentCategory) || "books"
  );
  const [status, setStatus] = useState<"all" | ContentStatus>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Sync category from URL param
  useEffect(() => {
    const cat = searchParams.get("cat") as ContentCategory;
    if (cat && categories.includes(cat)) setCategory(cat);
  }, [searchParams]);

  const worksQuery = useQuery({
    queryKey: ["my-works", category, status, search, dateFrom, dateTo, page],
    queryFn: () =>
      fetchContent(category, {
        mine: true,
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
    const isConfirmed = await confirm({
      title: t("work.deleteConfirm"),
      destructive: true,
      confirmText: t("confirm.delete"),
    });
    if (!isConfirmed) return;
    setDeletingId(id);
    try {
      await deleteContentItem(category as any, id);
      worksQuery.refetch();
      toast({ title: t("work.deleted") });
    } catch {
      toast({ variant: "destructive", title: t("work.deleteFailed") });
    } finally {
      setDeletingId(null);
    }
  };

  const hasActiveFilters = status !== "all" || search || dateFrom || dateTo;

  return (
    <div className="container mx-auto space-y-6 px-4 py-8 sm:px-6 sm:py-10">

      {/* Header */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">{t("work.myWorks")}</h1>
          <p className="mt-1 font-ui text-sm text-muted-foreground">{t("writer.filterSub")}</p>
        </div>
        {me?.is_writer_approved && (
          <Link to="/writer/new">
            <Button className="gap-2 h-11">
              <PlusSquare className="h-4 w-4" />
              {t("work.newWork")}
            </Button>
          </Link>
        )}
      </section>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { setCategory(cat); setPage(1); }}
            className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 font-ui text-sm font-medium transition-all ${category === cat
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/60 bg-background/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
          >
            <span>{categoryEmojis[cat]}</span>
            <span className="capitalize">{t(`work.${cat}`)}</span>
            {category === cat && worksQuery.data && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-xs">{worksQuery.data.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + filter panel */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-card">
        {/* Search bar always visible */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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

        {/* Collapsible filters */}
        {filtersOpen && (
          <div className="mt-4 grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="font-ui text-sm font-medium">{t("work.status")}</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
                <SelectTrigger className="h-10 font-ui"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptionValues.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{t(item.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-ui text-sm font-medium">{t("work.fromDate")}</Label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 pl-9 font-ui" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-ui text-sm font-medium">{t("work.toDate")}</Label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 pl-9 font-ui" />
              </div>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                className="font-ui text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={() => { setStatus("all"); setSearch(""); setDateFrom(""); setDateTo(""); setPage(1); }}
              >
                {t("myWorks.clearAll")}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Works list */}
      <section className="space-y-3">
        {worksQuery.isLoading && (
          <div className="rounded-xl border border-border/70 bg-card/80 p-6 text-center">
            <p className="font-ui text-sm text-muted-foreground animate-pulse">{t("writer.loading")}</p>
          </div>
        )}

        {!worksQuery.isLoading && worksQuery.data?.results?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/65 p-12 text-center">
            <span className="text-5xl">{categoryEmojis[category]}</span>
            <p className="mt-4 font-display text-lg font-medium text-foreground">{t("work.noneFound")}</p>
            <p className="mt-1 font-ui text-sm text-muted-foreground">
              {hasActiveFilters ? t("myWorks.noWorksHint") : t("myWorks.noWorksYet").replace("{category}", t(`work.${category}`))}
            </p>
            {!hasActiveFilters && me?.is_writer_approved && (
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
          return (
            <div
              key={item.id}
              className="group rounded-xl border border-border/70 bg-card/80 p-5 shadow-card transition-all hover:border-border hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl">
                    {categoryEmojis[category]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold text-foreground truncate">{item.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 font-ui text-xs font-medium capitalize ${CONTENT_STATUS_STYLES[item.status]}`}>
                        {t(`myWorks.status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`, item.status)}
                      </span>
                      {item.is_hidden && (
                        <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 text-[10px] uppercase tracking-wider">
                          {t("myWorks.hidden")}
                        </Badge>
                      )}
                      <span className="font-ui text-xs text-muted-foreground">
                        {t("myWorks.created")} {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                {me?.is_writer_approved && (
                  <div className="flex shrink-0 items-center gap-2">
                    {readPath && (
                      <a href={readPath} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm" className="h-9 gap-1.5 font-ui text-muted-foreground hover:text-foreground">
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">{t("myWorks.view")}</span>
                        </Button>
                      </a>
                    )}
                    <Link to={getEditPath(category, item.id)}>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5 font-ui">
                        <Edit3 className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("work.openEditor")}</span>
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      disabled={isDeleting}
                      onClick={() => handleDelete(item.id)}
                    >
                      {isDeleting
                        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        : <Trash2 className="h-4 w-4" />
                      }
                    </Button>
                  </div>
                )}
              </div>

              {item.description && (
                <p className="mt-3 font-ui text-sm text-muted-foreground line-clamp-2 pl-13">{item.description}</p>
              )}

              {item.rejection_reason && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/35 bg-red-500/10 p-3">
                  <span className="text-sm">⚠️</span>
                  <p className="font-ui text-sm text-red-700">
                    <strong>{t("myWorks.rejected")}</strong> {item.rejection_reason}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Pagination */}
      {(canPrev || canNext) && (
        <div className="flex items-center justify-between">
          <p className="font-ui text-xs text-muted-foreground">{t("admin.total")}: {worksQuery.data?.count || 0}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={() => setPage((p) => p - 1)} disabled={!canPrev}>
              {t("myWorks.previous")}
            </Button>
            <span className="flex h-9 items-center px-3 font-ui text-sm text-muted-foreground">{t("myWorks.page").replace("{page}", String(page))}</span>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setPage((p) => p + 1)} disabled={!canNext}>
              {t("myWorks.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyWorksPage;
