import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchContent, reviewContent } from "@/lib/api";
import { toExcerpt } from "@/lib/content";
import type { ContentCategory } from "@/lib/types";

const categories: ContentCategory[] = ["books", "poems", "stories"];

const statusStyles: Record<string, string> = {
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700",
};

const AdminContentReviewPage = () => {
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<ContentCategory>("books");
  const [status, setStatus] = useState<"all" | "draft" | "approved" | "rejected">("draft");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reasonById, setReasonById] = useState<Record<number, string>>({});

  const query = useQuery({
    queryKey: ["admin", "content-review", category, status, search, page],
    queryFn: () =>
      fetchContent(category, {
        status: status === "all" ? undefined : status,
        q: search,
        page,
        requiresAuth: true,
      }),
  });
  const queryErrorMessage =
    query.error instanceof Error
      ? query.error.message
      : "Could not load review queue. Check your permissions.";

  const handleReview = async (id: number, reviewStatus: "approved" | "rejected") => {
    try {
      await reviewContent(category, id, reviewStatus, reasonById[id] || "");
      await queryClient.invalidateQueries({ queryKey: ["admin", "content-review"] });
      toast.success(`Content ${reviewStatus}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Review failed.";
      toast.error(message);
    }
  };

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-5 w-5 text-primary" />
          <h1 className="font-display text-3xl font-semibold text-foreground">Content Review</h1>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
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
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as "all" | "draft" | "approved" | "rejected");
              setPage(1);
            }}
          >
            <SelectTrigger className="font-ui">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all</SelectItem>
              <SelectItem value="draft">draft</SelectItem>
              <SelectItem value="approved">approved</SelectItem>
              <SelectItem value="rejected">rejected</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="pl-9 font-ui" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        {query.data?.results?.length ? (
          <div className="space-y-4">
            {query.data.results.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-4 font-ui text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-xl font-semibold text-foreground">{item.title}</p>
                  <div className="flex items-center gap-2">
                    {category === "books" && item.has_draft_chapters && (
                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-blue-600 no-underline shadow-sm animate-pulse">
                        New Chapter
                      </span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-muted-foreground">Created: {new Date(item.created_at).toLocaleString()}</p>
                {item.description ? <p className="mt-2 text-foreground">{toExcerpt(item.description)}</p> : null}
                {item.rejection_reason ? <p className="mt-2 text-red-700">Current rejection: {item.rejection_reason}</p> : null}

                <Textarea
                  className="mt-3 font-ui"
                  placeholder="Rejection reason"
                  value={reasonById[item.id] || ""}
                  onChange={(e) => setReasonById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/admin/content-review/${category}/${item.id}`}>
                    <Button variant="outline">Open & Read</Button>
                  </Link>
                  <Button onClick={() => handleReview(item.id, "approved")}>Approve</Button>
                  <Button variant="destructive" onClick={() => handleReview(item.id, "rejected")}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 font-ui text-sm text-red-700">
            {queryErrorMessage}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/65 p-5 font-ui text-sm text-muted-foreground">
            {query.isLoading ? "Loading content queue..." : "No items found."}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-ui text-xs text-muted-foreground">Total: {query.data?.count || 0}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((prev) => prev - 1)} disabled={page <= 1}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((prev) => prev + 1)} disabled={!query.data?.next}>
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminContentReviewPage;
