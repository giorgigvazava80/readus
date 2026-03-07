import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Search, CheckCircle2, XCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchPendingWriterApplications, reviewWriterApplication } from "@/lib/api";

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

const AdminWriterApplicationsPage = () => {
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
      : "ვერ მოხერხდა განაცხადების ჩატვირთვა. შეამოწმეთ ნებართვები.";

  const handleReview = async (id: number, status: "approved" | "rejected") => {
    try {
      await reviewWriterApplication(id, status, commentById[id] || "");
      await queryClient.invalidateQueries({ queryKey: ["admin", "writer-applications", "pending"] });
      toast.success(status === "approved" ? "განაცხადი დადასტურებულია." : "განაცხადი უარყოფილია.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "განხილვა ვერ მოხერხდა.";
      toast.error(message);
    }
  };

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-7 shadow-card"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground tracking-tight">ავტორის განაცხადები</h1>
        </div>
        <div className="mt-5 max-w-lg">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              placeholder="ძიება მომხმარებლის სახელით/ელფოსტით/ტექსტით"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10 font-ui bg-background/50 h-11 rounded-xl transition-all border-border/60 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20"
            />
          </div>
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
                  className="rounded-xl border border-border/70 bg-background/50 backdrop-blur-sm p-5 font-ui text-sm shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
                        განაცხადი #{item.id}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3 w-3" />
                        გაგზავნილია: {new Date(item.created_at).toLocaleString("ka-GE")}
                      </p>
                    </div>
                  </div>

                  {item.sample_text ? (
                    <div className="mt-4 rounded-lg bg-muted/30 p-4 border border-border/40">
                      <p className="whitespace-pre-wrap text-foreground/90 italic align-middle leading-relaxed relative">
                        {item.sample_text}
                      </p>
                    </div>
                  ) : null}

                  {item.sample_file ? (
                    <div className="mt-3">
                      <a
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                        href={item.sample_file}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        ნიმუშის ფაილის გახსნა
                      </a>
                    </div>
                  ) : null}

                  <div className="mt-5 space-y-3 pt-4 border-t border-border/40">
                    <Textarea
                      className="font-ui bg-background/50 min-h-[80px] resize-none border-border/60 focus-visible:border-primary"
                      placeholder="რეზოლუციის კომენტარი ავტორისთვის (სურვილისამებრ)"
                      value={commentById[item.id] || ""}
                      onChange={(e) => setCommentById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        variant="destructive"
                        onClick={() => handleReview(item.id, "rejected")}
                        className="gap-1.5 rounded-xl bg-destructive/90 hover:bg-destructive shadow-sm"
                      >
                        <XCircle className="h-4 w-4" />
                        უარყოფა
                      </Button>
                      <Button
                        onClick={() => handleReview(item.id, "approved")}
                        className="gap-1.5 rounded-xl shadow-warm hover:shadow-lg transition-all"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        დამტკიცება
                      </Button>
                    </div>
                  </div>
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
              className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/40 p-5 text-center"
            >
              <ClipboardCheck className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="font-ui text-sm text-muted-foreground">
                {query.isLoading ? "განაცხადები იტვირთება..." : "მომლოდინე განაცხადები არ არის."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-6">
          <p className="font-ui text-sm font-medium text-muted-foreground">სულ მომლოდინე: {query.data?.count || 0}</p>
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

export default AdminWriterApplicationsPage;





