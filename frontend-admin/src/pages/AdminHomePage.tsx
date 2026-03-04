import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, FileClock, PenSquare, Shield } from "lucide-react";

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
      label: "Pending writer apps",
      value: pendingApplicationsQuery.data?.count || 0,
      icon: ClipboardCheck,
    },
    { id: "books", label: "Draft books", value: contentSummaryQuery.data?.books || 0, icon: FileClock },
    { id: "chapters", label: "Draft chapters", value: contentSummaryQuery.data?.chapters || 0, icon: FileClock },
    { id: "poems", label: "Draft poems", value: contentSummaryQuery.data?.poems || 0, icon: FileClock },
    { id: "stories", label: "Draft stories", value: contentSummaryQuery.data?.stories || 0, icon: FileClock },
  ];

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">ადმინის პორტალი</span>
            </div>
            <h1 className="mt-4 font-display text-4xl font-semibold text-foreground">მოდერაციის პანელი</h1>
            <p className="mt-2 font-body text-base text-muted-foreground">
              განხილვის რიგები და მოდერაციის დატვირთვის მიმოხილვა.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/writer-applications">
              <Button variant="outline" className="gap-2">
                <ClipboardCheck className="h-4 w-4" />
                ავტორის განაცხადები
              </Button>
            </Link>
            <Link to="/admin/content-review">
              <Button className="gap-2">
                <PenSquare className="h-4 w-4" />
                კონტენტის განხილვა
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((item) => (
          <div key={item.id} className="rounded-xl border border-border/70 bg-card/80 p-5 shadow-card">
            <item.icon className="h-4 w-4 text-primary" />
            <p className="mt-2 font-ui text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-display text-3xl font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </section>
      {loadErrorMessage ? (
        <section className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 font-ui text-sm text-red-700">
          {loadErrorMessage}
        </section>
      ) : null}
    </div>
  );
};

export default AdminHomePage;



