import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSearch, Search, User, Target, SearchIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAuditLogs } from "@/lib/api";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

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
      : "ვერ მოხერხდა აუდიტის ჩანაწერების ჩატვირთვა. შეამოწმეთ ნებართვები.";

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-7 shadow-card"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <FileSearch className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground tracking-tight">აუდიტის ჩანაწერები</h1>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="ქმედება ან აღწერა"
              className="pl-10 font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl transition-all"
            />
          </div>

          <div className="relative group">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                setPage(1);
              }}
              placeholder="შემსრულებლის ელფოსტა"
              className="pl-10 font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl transition-all"
            />
          </div>

          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl transition-all"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl transition-all"
          />
        </div>
      </motion.section>

      <section className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-7 shadow-card min-h-[400px]">
        <AnimatePresence mode="wait">
          {query.data?.results?.length ? (
            <motion.div
              key="list"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {query.data.results.map((item) => (
                <motion.div
                  key={item.id}
                  variants={itemVariants}
                  className="rounded-xl border border-border/70 bg-background/50 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                >
                  <p className="font-display text-xl font-bold text-foreground inline-flex items-center gap-2">
                    {item.action}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 p-4 rounded-xl border border-border/40 bg-muted/10">
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground">შემსრულებელი</p>
                        <p className="font-ui text-sm font-medium text-foreground">{item.actor_email || "სისტემა"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Target className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground">სამიზნე</p>
                        <p className="font-ui text-sm font-medium text-foreground">{item.target_type}:{item.target_id || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 sm:col-span-2 md:col-span-1">
                      <div className="flex flex-col">
                        <p className="font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground">დრო</p>
                        <p className="font-ui text-sm font-medium text-foreground">{new Date(item.created_at).toLocaleString("ka-GE")}</p>
                      </div>
                    </div>
                  </div>

                  {item.description && (
                    <div className="mt-4 bg-muted/20 border-l-2 border-primary/40 pl-4 py-2 text-sm font-body italic text-foreground/80">
                      {item.description}
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          ) : query.isError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 font-ui text-sm text-red-700 font-medium"
            >
              {queryErrorMessage}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex min-h-[200px] flex-col items-center justify-center mt-4 rounded-xl border border-dashed border-border/80 bg-background/40 p-5 font-ui text-sm text-muted-foreground"
            >
              <SearchIcon className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p>{query.isLoading ? "აუდიტის ჩანაწერები იტვირთება..." : "ჩანაწერები ვერ მოიძებნა."}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-6">
          <p className="font-ui text-sm font-medium text-muted-foreground">სულ: {query.data?.count || 0}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => prev - 1)}
              disabled={page <= 1}
              className="rounded-lg hover:bg-muted"
            >
              წინა
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={!query.data?.next}
              className="rounded-lg hover:bg-muted"
            >
              შემდეგი
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminAuditLogsPage;
