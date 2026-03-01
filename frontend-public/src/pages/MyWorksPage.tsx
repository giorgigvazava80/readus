import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Filter, PlusSquare, Search, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const categories: ContentCategory[] = ["books", "chapters", "poems", "stories"];

const statusOptions: Array<{ label: string; value: "all" | ContentStatus }> = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "დამტკიცებული", value: "approved" },
  { label: "უარყოფილი", value: "rejected" },
];

function getEditPath(category: ContentCategory, id: number): string {
  if (category === "books") {
    return `/writer/books/${id}/edit`;
  }
  if (category === "chapters") {
    return `/writer/chapters/${id}/edit`;
  }
  if (category === "poems") {
    return `/writer/poems/${id}/edit`;
  }
  return `/writer/stories/${id}/edit`;
}

const MyWorksPage = () => {
  const { me } = useSession();

  const [category, setCategory] = useState<ContentCategory>("books");
  const [status, setStatus] = useState<"all" | ContentStatus>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

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

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold text-foreground">ჩემი ნაშრომები</h1>
            <p className="mt-2 font-body text-base text-muted-foreground">
              გაფილტრე გაგზავნილი ნაშრომები სტატუსის, თარიღის დიაპაზონისა და საკვანძო სიტყვების მიხედვით.
            </p>
          </div>
          {me?.is_writer_approved ? (
            <Link to="/writer/new">
              <Button className="gap-2">
                <PlusSquare className="h-4 w-4" />
                ახალი ნაშრომი
              </Button>
            </Link>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label className="font-ui">ტიპი</Label>
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value as ContentCategory);
                setPage(1);
              }}
            >
              <SelectTrigger className="font-ui">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-ui">სტატუსი</Label>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as "all" | ContentStatus);
                setPage(1);
              }}
            >
              <SelectTrigger className="font-ui">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-ui">ძებნა</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="სათაური ან ტექსტი"
                className="pl-9 font-ui"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-ui">თარიღიდან</Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="pl-9 font-ui" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-ui">თარიღამდე</Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="pl-9 font-ui" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        {worksQuery.isLoading ? <p className="font-ui text-sm text-muted-foreground">ნაშრომები იტვირთება...</p> : null}

        {worksQuery.data?.results?.length ? (
          <div className="space-y-3">
            {worksQuery.data.results.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-4 font-ui text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-xl font-semibold text-foreground">{item.title}</p>
                  <div className="flex items-center gap-2">
                    {item.is_hidden && (
                      <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 text-[10px] uppercase tracking-wider">
                        Hidden
                      </Badge>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${CONTENT_STATUS_STYLES[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-muted-foreground">
                  შექმნის დრო: {new Date(item.created_at).toLocaleString()}
                </p>
                {item.description ? <p className="mt-2 text-foreground">{item.description}</p> : null}
                {item.rejection_reason ? (
                  <p className="mt-3 rounded-lg border border-red-500/35 bg-red-500/10 p-3 text-red-700">
                    უარყოფის reason: {item.rejection_reason}
                  </p>
                ) : null}

                {me?.is_writer_approved ? (
                  <div className="mt-4 flex items-center justify-between">
                    <Link to={getEditPath(category, item.id)}>
                      <Button variant="outline" size="sm">რედაქტორის გახსნა</Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        if (window.confirm("ნამდვილად გსურს ამ ნაშრომის წაშლა? მოქმედება შეუქცევადია.")) {
                          try {
                            await deleteContentItem(category as any, item.id);
                            worksQuery.refetch();
                            toast({ title: "ნაშრომი წაიშალა" });
                          } catch (error) {
                            toast({ variant: "destructive", title: "წაშლა ვერ მოხერხდა" });
                          }
                        }
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          !worksQuery.isLoading ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-background/65 p-5 font-ui text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                ნამუშევრები ვერ მოიძებნა არჩეული ფილტრებისთვის.
              </div>
            </div>
          ) : null
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-ui text-xs text-muted-foreground">სულ: {worksQuery.data?.count || 0}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((prev) => prev - 1)} disabled={!canPrev}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((prev) => prev + 1)} disabled={!canNext}>
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MyWorksPage;





