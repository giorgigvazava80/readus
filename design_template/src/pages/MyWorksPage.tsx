import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, AlertCircle, Eye, FileEdit, Plus } from "lucide-react";
import { Link } from "react-router-dom";

const statusConfig = {
  draft: {
    label: "Draft",
    icon: FileEdit,
    borderClass: "status-border-draft",
    bgClass: "status-bg-draft",
    dotColor: "hsl(var(--status-draft))",
  },
  submitted: {
    label: "Submitted",
    icon: Clock,
    borderClass: "status-border-submitted",
    bgClass: "status-bg-submitted",
    dotColor: "hsl(var(--status-submitted))",
  },
  in_review: {
    label: "In Review",
    icon: Eye,
    borderClass: "status-border-in_review",
    bgClass: "status-bg-in_review",
    dotColor: "hsl(var(--status-review))",
  },
  published: {
    label: "Published",
    icon: CheckCircle2,
    borderClass: "status-border-published",
    bgClass: "status-bg-published",
    dotColor: "hsl(var(--status-published))",
  },
  rejected: {
    label: "Needs Revision",
    icon: AlertCircle,
    borderClass: "status-border-rejected",
    bgClass: "status-bg-rejected",
    dotColor: "hsl(var(--status-rejected))",
  },
};

const myWorks = [
  { id: "a", title: "The Amber Lighthouse", category: "Novel", status: "published" as const, date: "Feb 12, 2026" },
  { id: "b", title: "Whispers in the Garden", category: "Poem", status: "in_review" as const, date: "Feb 20, 2026" },
  { id: "c", title: "Midnight Trains", category: "Short Story", status: "submitted" as const, date: "Feb 25, 2026" },
  { id: "d", title: "Untitled Draft", category: "Novel", status: "draft" as const, date: "Feb 28, 2026" },
];

const statusLabels: Record<string, string> = {
  published: "Your work is live and visible to readers.",
  in_review: "Our editors are reviewing your submission.",
  submitted: "Received — awaiting editorial queue.",
  draft: "Not yet submitted.",
  rejected: "Feedback sent — revisions needed.",
};

const MyWorksPage = () => (
  <div className="container mx-auto px-4 sm:px-6 py-10 md:py-14">
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-10">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">
            My Works
          </h1>
          <p className="mt-1.5 font-ui text-sm text-muted-foreground">
            Track the status of your submissions
          </p>
        </div>
        <Link to="/submit">
          <Button className="gap-2 font-ui font-medium shadow-sm w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            New Submission
          </Button>
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Total", count: myWorks.length, color: "hsl(var(--foreground))" },
          { label: "Published", count: myWorks.filter(w => w.status === "published").length, color: "hsl(var(--status-published))" },
          { label: "In Review", count: myWorks.filter(w => w.status === "in_review" || w.status === "submitted").length, color: "hsl(var(--status-review))" },
          { label: "Drafts", count: myWorks.filter(w => w.status === "draft").length, color: "hsl(var(--status-draft))" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-card p-4 text-center shadow-card"
          >
            <p className="font-display text-2xl font-bold" style={{ color: stat.color }}>
              {stat.count}
            </p>
            <p className="font-ui text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Work list */}
      <div className="space-y-3">
        {myWorks.map((work, i) => {
          const config = statusConfig[work.status];
          const StatusIcon = config.icon;
          return (
            <motion.div
              key={work.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border-l-4 border border-l-[var(--sl-color)] bg-card p-4 sm:p-5 shadow-card transition-all hover:shadow-card-hover ${config.borderClass}`}
            >
              <div className="flex items-start gap-4">
                {/* Status dot */}
                <div
                  className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: config.dotColor + "1a", color: config.dotColor }}
                >
                  <StatusIcon className="h-4 w-4" />
                </div>

                <div>
                  <h3 className="font-display text-base font-semibold text-foreground leading-tight">
                    {work.title}
                  </h3>
                  <p className="font-ui text-xs text-muted-foreground mt-0.5">
                    {work.category} · {work.date}
                  </p>
                  <p className="font-ui text-xs text-muted-foreground mt-1 italic">
                    {statusLabels[work.status]}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-12 sm:ml-0 flex-shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-ui font-medium ${config.bgClass}`}
                  style={{ color: config.dotColor }}
                >
                  <StatusIcon className="h-3 w-3" />
                  {config.label}
                </span>
                {work.status === "published" && (
                  <Link to={`/read/${work.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs font-ui">
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  </Link>
                )}
                {(work.status === "draft" || work.status === "rejected") && (
                  <Link to="/submit">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs font-ui">
                      <FileEdit className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </Link>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  </div>
);

export default MyWorksPage;
