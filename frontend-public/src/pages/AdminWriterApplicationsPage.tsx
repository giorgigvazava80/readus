import { useI18n } from "@/i18n";
﻿import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchPendingWriterApplications, reviewWriterApplication } from "@/lib/api";

const AdminWriterApplicationsPage = () => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [commentById, setCommentById] = useState<Record<number, string>>({});

  const query = useQuery({
    queryKey: ["admin", "writer-applications", "pending", page, search],
    queryFn: () => fetchPendingWriterApplications(page, search),
  });
  const queryErrorMessage =
    query.error instanceof Error
      ? query.error.message
      : "Could not load pending applications. Check your permissions.";

  const handleReview = async (id: number, status: "approved" | "rejected") => {
    try {
      await reviewWriterApplication(id, status, commentById[id] || "");
      await queryClient.invalidateQueries({ queryKey: ["admin", "writer-applications", "pending"] });
      toast.success(`Application ${status}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Review failed.";
      toast.error(message);
    }
  };

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h1 className="font-display text-3xl font-semibold text-foreground">{t("admin.writerApps")}</h1>
        </div>
        <div className="mt-4 max-w-lg">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ძიება მომხმარებლის სახელით/ელფოსტით/ტექსტით"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 font-ui"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        {query.data?.results?.length ? (
          <div className="space-y-4">
            {query.data.results.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-4 font-ui text-sm">
                <p className="font-display text-xl font-semibold text-foreground">Application #{item.id}</p>
                <p className="mt-1 text-muted-foreground">{t("admin.createdTime")}: {new Date(item.created_at).toLocaleString()}</p>
                {item.sample_text ? <p className="mt-3 whitespace-pre-wrap text-foreground">{item.sample_text}</p> : null}
                {item.sample_file ? (
                  <p className="mt-2">
                    ნიმუშის ფაილი:{" "}
                    <a className="text-primary underline-offset-4 hover:underline" href={item.sample_file} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </p>
                ) : null}
                <Textarea
                  className="mt-3 font-ui"
                  placeholder="Resolution comment"
                  value={commentById[item.id] || ""}
                  onChange={(e) => setCommentById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => handleReview(item.id, "approved")}>დამტკიცება</Button>
                  <Button variant="destructive" onClick={() => handleReview(item.id, "rejected")}>უარყოფა</Button>
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
            {query.isLoading ? "Loading pending applications..." : "No pending applications."}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-ui text-xs text-muted-foreground">Total pending: {query.data?.count || 0}</p>
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

export default AdminWriterApplicationsPage;





