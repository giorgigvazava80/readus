import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle, Eye, FileEdit } from "lucide-react";

const statusConfig = {
  draft: { label: "Draft", icon: FileEdit, variant: "outline" as const },
  submitted: { label: "Submitted", icon: Clock, variant: "secondary" as const },
  in_review: { label: "In Review", icon: Eye, variant: "secondary" as const },
  published: { label: "Published", icon: CheckCircle2, variant: "default" as const },
  rejected: { label: "Needs Revision", icon: AlertCircle, variant: "destructive" as const },
};

const myWorks = [
  { id: "a", title: "The Amber Lighthouse", category: "Novel", status: "published" as const, date: "Feb 12, 2026" },
  { id: "b", title: "Whispers in the Garden", category: "Poem", status: "in_review" as const, date: "Feb 20, 2026" },
  { id: "c", title: "Midnight Trains", category: "Short Story", status: "submitted" as const, date: "Feb 25, 2026" },
  { id: "d", title: "Untitled Draft", category: "Novel", status: "draft" as const, date: "Feb 28, 2026" },
];

const MyWorksPage = () => (
  <div className="container mx-auto px-6 py-12">
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="font-display text-3xl font-bold text-foreground">My Works</h1>
      <p className="mt-1 font-ui text-sm text-muted-foreground">
        Track the status of your submissions
      </p>

      <div className="mt-8 space-y-3">
        {myWorks.map((work, i) => {
          const config = statusConfig[work.status];
          return (
            <motion.div
              key={work.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-card transition-all hover:shadow-card-hover"
            >
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">{work.title}</h3>
                <p className="mt-0.5 font-ui text-xs text-muted-foreground">
                  {work.category} · Submitted {work.date}
                </p>
              </div>
              <Badge variant={config.variant} className="gap-1 font-ui">
                <config.icon className="h-3 w-3" />
                {config.label}
              </Badge>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  </div>
);

export default MyWorksPage;
