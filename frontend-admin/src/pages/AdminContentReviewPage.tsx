import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Search, BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

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

const categories: ContentCategory[] = ["books", "chapters", "poems", "stories"];
const categoryMap: Record<ContentCategory, string> = {
  books: "წიგნები",
  chapters: "თავები",
  poems: "ლექსები",
  stories: "მოთხრობები",
};

const statusStyles: Record<string, string> = {
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700",
};

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
      : "ვერ მოხერხდა კონტენტის რიგის ჩატვირთვა. შეამოწმეთ ნებართვები.";

  const handleReview = async (id: number, reviewStatus: "approved" | "rejected") => {
    try {
      await reviewContent(category, id, reviewStatus, reasonById[id] || "");
      await queryClient.invalidateQueries({ queryKey: ["admin", "content-review"] });
      toast.success(reviewStatus === "approved" ? "კონტენტი დადასტურებულია." : "კონტენტი უარყოფილია.");
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
            <BookOpenCheck className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground tracking-tight">კონტენტის განხილვა</h1>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value as ContentCategory);
              setPage(1);
            }}
          >
            <SelectTrigger className="font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus:ring-primary/20 rounded-xl transition-all">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/60 shadow-lg">
              {categories.map((item) => (
                <SelectItem key={item} value={item} className="rounded-lg">{categoryMap[item]}</SelectItem>
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
            <SelectTrigger className="font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus:ring-primary/20 rounded-xl transition-all">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/60 shadow-lg">
              <SelectItem value="all" className="rounded-lg">ყველა</SelectItem>
              <SelectItem value="draft" className="rounded-lg">შავი ვერსია</SelectItem>
              <SelectItem value="approved" className="rounded-lg">დამტკიცებული</SelectItem>
              <SelectItem value="rejected" className="rounded-lg">უარყოფილი</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ძებნა"
              className="pl-10 font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl transition-all"
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
                  className="rounded-xl border border-border/70 bg-background/50 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-2xl font-bold text-foreground tracking-tight">{item.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {category === "books" && item.has_draft_chapters && (
                            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 no-underline shadow-sm animate-pulse">
                              ახალი თავი
                            </span>
                          )}
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusStyles[item.status]}`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <p className="font-ui text-xs text-muted-foreground">
                        შექმნის დრო: <span className="text-foreground/80 font-medium">{new Date(item.created_at).toLocaleString("ka-GE")}</span>
                      </p>
                    </div>
                  </div>

                  {item.description ? (
                    <div className="mt-4 rounded-lg bg-muted/20 p-4 border border-border/40">
                      <p className="font-body text-sm leading-relaxed text-foreground/90 italic border-l-2 border-primary/40 pl-3">
                        {toExcerpt(item.description)}
                      </p>
                    </div>
                  ) : null}

                  {item.rejection_reason && (
                    <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                      <p className="font-ui text-sm text-red-700 flex items-center gap-2">
                        <XCircle className="h-4 w-4 shrink-0" />
                        <span className="font-medium">მიმდინარე უარყოფის მიზეზი:</span> {item.rejection_reason}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 space-y-4 pt-4 border-t border-border/40">
                    <Textarea
                      className="font-ui bg-background/50 min-h-[80px] resize-none border-border/60 focus-visible:border-primary"
                      placeholder="უარყოფის მიზეზი (აუცილებელია უარყოფის შემთხვევაში)"
                      value={reasonById[item.id] || ""}
                      onChange={(e) => setReasonById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link to={`/admin/content-review/${category}/${item.id}`}>
                        <Button variant="outline" className="gap-2 rounded-xl h-10 hover:bg-primary/5 hover:text-primary transition-colors border-border/70 hover:border-primary/30">
                          <BookOpen className="h-4 w-4" />
                          გახსნა და წაკითხვა
                        </Button>
                      </Link>
                      <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                        <Button
                          variant="destructive"
                          onClick={() => handleReview(item.id, "rejected")}
                          className="flex-1 sm:flex-none gap-1.5 rounded-xl bg-destructive/90 hover:bg-destructive shadow-sm"
                        >
                          <XCircle className="h-4 w-4" />
                          უარყოფა
                        </Button>
                        <Button
                          onClick={() => handleReview(item.id, "approved")}
                          className="flex-1 sm:flex-none gap-1.5 rounded-xl shadow-warm hover:shadow-lg transition-all"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          დამტკიცება
                        </Button>
                      </div>
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
              <BookOpenCheck className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="font-ui text-sm text-muted-foreground">
                {query.isLoading ? "კონტენტის რიგი იტვირთება..." : "ჩანაწერები ვერ მოიძებნა."}
              </p>
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

export default AdminContentReviewPage;
