import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, FileClock, PenSquare, Shield } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { fetchContent, fetchPendingWriterApplications } from "@/lib/api";

const AdminHomePage = () => {
  const pendingApplicationsQuery = useQuery({
    queryKey: ["admin", "writer-applications", "pending", 1],
    queryFn: () => fetchPendingWriterApplications(1),
  });

  const contentSummaryQuery = useQuery({
    queryKey: ["admin", "content-summary"],
    queryFn: async () => {
      const [books, chapters, poems, stories] = await Promise.all([
        fetchContent("books", { status: "draft", page: 1 }),
        fetchContent("chapters", { status: "draft", page: 1 }),
        fetchContent("poems", { status: "draft", page: 1 }),
        fetchContent("stories", { status: "draft", page: 1 }),
      ]);
      return {
        books: books.count,
        chapters: chapters.count,
        poems: poems.count,
        stories: stories.count,
      };
    },
  });
  const loadErrorMessage =
    pendingApplicationsQuery.error instanceof Error
      ? pendingApplicationsQuery.error.message
      : contentSummaryQuery.error instanceof Error
        ? contentSummaryQuery.error.message
        : null;

  const stats = [
    {
      id: "apps",
      label: "მომლოდინე ავტორები",
      value: pendingApplicationsQuery.data?.count || 0,
      icon: ClipboardCheck,
      color: "hsl(24 60% 55%)",
      bg: "hsl(24 60% 55% / 0.15)",
      border: "hsl(24 60% 55% / 0.2)",
    },
    {
      id: "books",
      label: "შავი ვერსიის წიგნები",
      value: contentSummaryQuery.data?.books || 0,
      icon: FileClock,
      color: "hsl(215 40% 45%)",
      bg: "hsl(215 40% 45% / 0.15)",
      border: "hsl(215 40% 45% / 0.2)",
    },
    {
      id: "chapters",
      label: "შავი ვერსიის თავები",
      value: contentSummaryQuery.data?.chapters || 0,
      icon: FileClock,
      color: "hsl(150 25% 45%)",
      bg: "hsl(150 25% 45% / 0.15)",
      border: "hsl(150 25% 45% / 0.2)",
    },
    {
      id: "poems",
      label: "შავი ვერსიის ლექსები",
      value: contentSummaryQuery.data?.poems || 0,
      icon: FileClock,
      color: "hsl(32 50% 48%)",
      bg: "hsl(32 50% 48% / 0.15)",
      border: "hsl(32 50% 48% / 0.2)",
    },
    {
      id: "stories",
      label: "შავი ვერსიის მოთხრობები",
      value: contentSummaryQuery.data?.stories || 0,
      icon: FileClock,
      color: "hsl(228 35% 50%)",
      bg: "hsl(228 35% 50% / 0.15)",
      border: "hsl(228 35% 50% / 0.2)",
    },
  ];

  return (
    <div className="container mx-auto space-y-8 px-6 py-10 relative">
      <div
        className="absolute top-0 right-10 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "hsl(36 70% 50%)" }}
      />
      <div
        className="absolute top-20 left-10 w-48 h-48 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "hsl(16 60% 52%)" }}
      />

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-7 shadow-card overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-subtle pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 shadow-sm">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-ui text-xs font-medium text-primary">ადმინის პორტალი</span>
            </div>
            <h1 className="mt-4 font-display text-4xl font-semibold text-foreground tracking-tight">მოდერაციის პანელი</h1>
            <p className="mt-2 font-body text-base text-muted-foreground max-w-xl">
              განხილვის რიგები და მოდერაციის დატვირთვის მიმოხილვა.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/writer-applications">
              <Button variant="outline" className="gap-2 font-ui hover:bg-primary/5 hover:border-primary/40 transition-colors rounded-xl h-11 px-5">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                ავტორის განაცხადები
              </Button>
            </Link>
            <Link to="/admin/content-review">
              <Button className="gap-2 font-ui shadow-warm hover:shadow-lg transition-all rounded-xl h-11 px-5">
                <PenSquare className="h-4 w-4" />
                კონტენტის განხილვა
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        {stats.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
            className="group rounded-2xl border bg-background/40 backdrop-blur-md p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
            style={{ borderColor: item.border }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl mb-3 shadow-sm"
              style={{ background: item.bg }}
            >
              <item.icon className="h-4 w-4" style={{ color: item.color }} />
            </div>
            <p className="font-display text-3xl font-bold text-foreground leading-none">{item.value}</p>
            <p className="mt-2 font-ui text-xs font-medium text-muted-foreground">{item.label}</p>
          </motion.div>
        ))}
      </motion.section>

      {loadErrorMessage ? (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 font-ui text-sm text-red-700"
        >
          {loadErrorMessage}
        </motion.section>
      ) : null}
    </div>
  );
};

export default AdminHomePage;




