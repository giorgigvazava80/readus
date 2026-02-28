import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Feather, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import WorkCard, { type PublicWorkCardItem } from "@/components/WorkCard";
import { fetchContent } from "@/lib/api";
import type { ContentItem } from "@/lib/types";
import heroImage from "@/assets/hero-literary.jpg";

const CATEGORY_COLOR_PALETTE: Record<"books" | "stories" | "poems", string[]> = {
  books: ["hsl(36, 70%, 50%)", "hsl(32, 65%, 45%)", "hsl(28, 72%, 48%)"],
  stories: ["hsl(200, 45%, 42%)", "hsl(160, 40%, 38%)", "hsl(220, 50%, 44%)"],
  poems: ["hsl(10, 65%, 50%)", "hsl(350, 55%, 47%)", "hsl(280, 35%, 42%)"],
};

function toExcerpt(item: ContentItem): string {
  const raw = [item.body, item.extracted_text, item.description].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (!raw) {
    return "No preview available yet.";
  }
  if (raw.length <= 190) {
    return raw;
  }
  return `${raw.slice(0, 187)}...`;
}

function estimateReadTime(item: ContentItem): string {
  const text = [item.body, item.extracted_text, item.description].filter(Boolean).join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return `${minutes} min read`;
}

function colorFor(category: "books" | "stories" | "poems", id: number): string {
  const palette = CATEGORY_COLOR_PALETTE[category];
  return palette[id % palette.length];
}

function toCardItem(category: "books" | "stories" | "poems", item: ContentItem): PublicWorkCardItem {
  return {
    id: item.id,
    category,
    title: item.title,
    author: item.author_name || item.author_username || "Unknown author",
    excerpt: toExcerpt(item),
    coverColor: colorFor(category, item.id),
    date: new Date(item.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    readTime: estimateReadTime(item),
    createdAt: item.created_at,
  };
}

const PublicHomePage = () => {
  const worksQuery = useQuery({
    queryKey: ["public-home", "featured"],
    queryFn: async () => {
      const [books, stories, poems] = await Promise.all([
        fetchContent("books", { status: "approved", page: 1 }),
        fetchContent("stories", { status: "approved", page: 1 }),
        fetchContent("poems", { status: "approved", page: 1 }),
      ]);

      const raw = [
        ...books.results.map((item) => ({ category: "books" as const, item })),
        ...stories.results.map((item) => ({ category: "stories" as const, item })),
        ...poems.results.map((item) => ({ category: "poems" as const, item })),
      ].sort((a, b) => new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime());

      const works = raw.map(({ category, item }) => toCardItem(category, item));

      return {
        works,
        counts: {
          books: books.count,
          stories: stories.count,
          poems: poems.count,
        },
      };
    },
  });

  const works = worksQuery.data?.works || [];
  const publishedCount =
    (worksQuery.data?.counts.books || 0) +
    (worksQuery.data?.counts.stories || 0) +
    (worksQuery.data?.counts.poems || 0);
  const authorsCount = new Set(works.map((work) => work.author)).size;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const newThisMonth = works.filter((work) => {
    const created = new Date(work.createdAt);
    return `${created.getFullYear()}-${created.getMonth()}` === monthKey;
  }).length;

  const stats = [
    { icon: BookOpen, value: `${publishedCount}+`, label: "Published Works" },
    { icon: Users, value: `${authorsCount}+`, label: "Authors" },
    { icon: Feather, value: `${newThisMonth}+`, label: "New This Month" },
  ];

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Open book with pen" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>
        <div className="container relative mx-auto px-6 pb-20 pt-24 md:pb-28 md:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
              Where Words Find <span className="text-gradient-primary">Their Home</span>
            </h1>
            <p className="mt-5 font-body text-lg leading-relaxed text-muted-foreground md:text-xl">
              Public pages are open for everyone. Reader accounts are for interaction features like reviews, likes,
              comments and personalized activity. Writers publish after editorial approval.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/browse">
                <Button size="lg" className="gap-2">
                  Browse Library
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="outline" className="gap-2">
                  Join as Reader or Writer
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 grid max-w-lg grid-cols-3 gap-6"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center md:text-left">
                <stat.icon className="mx-auto mb-1.5 h-5 w-5 text-primary md:mx-0" />
                <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="font-ui text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="border-t bg-card/50 py-16">
        <div className="container mx-auto px-6">
          <h2 className="font-display text-2xl font-bold text-foreground">How It Works</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Read Publicly",
                desc: "Anyone can browse and read approved books, stories, and poetry without creating an account.",
              },
              {
                step: "02",
                title: "Join as Reader",
                desc: "Create a reader account to interact through reviews, likes, comments, bookmarks and profile activity.",
              },
              {
                step: "03",
                title: "Become Writer",
                desc: "Apply as writer with sample proof. After approval, submit works and manage your publishing queue.",
              },
            ].map((item) => (
              <div key={item.step} className="group">
                <span className="font-display text-4xl font-bold text-primary/20 transition-colors group-hover:text-primary/40">
                  {item.step}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 font-ui text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Featured Works</h2>
              <p className="mt-1 font-ui text-sm text-muted-foreground">Recently approved and published works</p>
            </div>
            <Link to="/browse">
              <Button variant="ghost" className="gap-1 text-sm">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {worksQuery.isLoading ? <p className="mt-8 text-sm text-muted-foreground">Loading featured works...</p> : null}

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {works.slice(0, 6).map((work, index) => (
              <WorkCard key={`${work.category}-${work.id}`} work={work} index={index} />
            ))}
          </div>

          {!worksQuery.isLoading && works.length === 0 ? (
            <p className="mt-8 text-sm text-muted-foreground">No published works yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default PublicHomePage;
