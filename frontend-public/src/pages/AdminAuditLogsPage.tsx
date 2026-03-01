import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSearch, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAuditLogs } from "@/lib/api";

const AdminAuditLogsPage = () => {
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "audit-logs", q, actor, dateFrom, dateTo, page],
    queryFn: () =>
      fetchAuditLogs({
        q,
        actor,
        date_from: dateFrom,
        date_to: dateTo,
        page,
      }),
  });
  const queryErrorMessage =
    query.error instanceof Error
      ? query.error.message
      : "Could not load audit logs. Check your permissions.";

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-primary" />
          <h1 className="font-display text-3xl font-semibold text-foreground">აუდიტის ჩანაწერები</h1>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="ქმედება ან აღწერა"
              className="pl-9 font-ui"
            />
          </div>
          <Input
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              setPage(1);
            }}
            placeholder="შემსრულებლის ელფოსტა"
            className="font-ui"
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="font-ui"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="font-ui"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        {query.data?.results?.length ? (
          <div className="space-y-3">
            {query.data.results.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-4 font-ui text-sm">
                <p className="font-display text-xl font-semibold text-foreground">{item.action}</p>
                <p className="mt-1 text-muted-foreground">
                  Actor: {item.actor_email || "system"} | {new Date(item.created_at).toLocaleString()}
                </p>
                <p className="mt-2 text-foreground">{item.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Target: {item.target_type}:{item.target_id || "-"}
                </p>
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 font-ui text-sm text-red-700">
            {queryErrorMessage}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/65 p-5 font-ui text-sm text-muted-foreground">
            {query.isLoading ? "Loading audit logs..." : "No logs found."}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-ui text-xs text-muted-foreground">სულ: {query.data?.count || 0}</p>
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

export default AdminAuditLogsPage;





