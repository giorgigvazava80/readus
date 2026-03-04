import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Feather, Users, Sparkles, Eye, UserPlus, PenTool } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import WorkCard, { type PublicWorkCardItem } from "@/components/WorkCard";
import { useI18n } from "@/i18n";
import { resolveAuthorKey } from "@/lib/authors";
import { fetchContent, resolveMediaUrl } from "@/lib/api";
import type { ContentItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import heroImage from "@/assets/hero-literary.jpg";

const CATEGORY_COLOR_PALETTE: Record<"books" | "stories" | "poems", string[]> = {
  books: ["hsl(24, 60%, 55%)", "hsl(32, 50%, 48%)", "hsl(14, 55%, 52%)"],
  stories: ["hsl(215, 40%, 45%)", "hsl(228, 35%, 50%)", "hsl(200, 45%, 42%)"],
  poems: ["hsl(150, 25%, 45%)", "hsl(165, 30%, 40%)", "hsl(135, 20%, 50%)"],
};

function toExcerpt(item: ContentItem, fallback: string): string {
  const rawHtml = item.description || item.extracted_text || item.body || "";
  // Remove HTML tags using regex and clean up extra spaces
  const raw = rawHtml.replace(/<[^>]*>?/gm, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  if (!raw) return fallback;
  if (raw.length <= 190) return raw;
  return `${raw.slice(0, 187)}...`;
}

function estimateReadTime(item: ContentItem, template: string): string {
  const text = [item.body, item.extracted_text, item.description].filter(Boolean).join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return template.replace("{minutes}", String(minutes));
}

function colorFor(category: "books" | "stories" | "poems", id: number): string {
  const palette = CATEGORY_COLOR_PALETTE[category];
  return palette[id % palette.length];
}

function toCardItem(
  category: "books" | "stories" | "poems",
  item: ContentItem,
  locale: string,
  excerptFallback: string,
  readTimeTemplate: string,
): PublicWorkCardItem {
  return {
    id: item.id,
    publicSlug: item.public_slug || String(item.id),
    category,
    title: item.title,
    author: item.author_name || item.author_username || "",
    authorKey: resolveAuthorKey(item),
    excerpt: toExcerpt(item, excerptFallback),
    coverColor: colorFor(category, item.id),
    coverImageUrl: resolveMediaUrl(item.cover_image),
    date: new Date(item.created_at).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    readTime: estimateReadTime(item, readTimeTemplate),
    createdAt: item.created_at,
    isHidden: item.is_hidden,
  };
}

const PublicHomePage = () => {
  const { t, language } = useI18n();
  const isGeorgian = language === "ka";
  const locale = language === "ka" ? "ka-GE" : "en-US";
  const excerptFallback = t("home.excerptUnavailable", "Excerpt is not available yet.");
  const readTimeTemplate = t("home.readTime", "{minutes} min read");
  const steps = [
    {
      step: "01",
      icon: Eye,
      title: t("home.step1.title", "Read Publicly"),
      desc: t(
        "home.step1.desc",
        "Anyone can read approved books, stories, and poetry without creating an account.",
      ),
    },
    {
      step: "02",
      icon: UserPlus,
      title: t("home.step2.title", "Join as Reader"),
      desc: t(
        "home.step2.desc",
        "Create a reader account to leave ratings, likes, comments, bookmarks, and track activity.",
      ),
    },
    {
      step: "03",
      icon: PenTool,
      title: t("home.step3.title", "Become a Writer"),
      desc: t(
        "home.step3.desc",
        "Submit a writer application with a sample. After approval, you can submit and manage publications.",
      ),
    },
  ];

  const worksQuery = useQuery({
    queryKey: ["public-home", "featured", language],
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

      const works = raw.map(({ category, item }) =>
        toCardItem(category, item, locale, excerptFallback, readTimeTemplate),
      );

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
  const monthKey = `${now.getFullYear()} -${now.getMonth()} `;
  const newThisMonth = works.filter((work) => {
    const created = new Date(work.createdAt);
    return `${created.getFullYear()} -${created.getMonth()} ` === monthKey;
  }).length;

  const stats = [
    {
      icon: BookOpen,
      value: `${publishedCount} +`,
      label: t("home.stats.published", "Published works"),
      color: "hsl(24 60% 55%)",
      bg: "hsl(24 60% 55% / 0.15)",
      border: "hsl(24 60% 55% / 0.2)",
    },
    {
      icon: Users,
      value: `${authorsCount} +`,
      label: t("home.stats.authors", "Authors"),
      color: "hsl(215 40% 45%)",
      bg: "hsl(215 40% 45% / 0.15)",
      border: "hsl(215 40% 45% / 0.2)",
    },
    {
      icon: Feather,
      value: `${newThisMonth} +`,
      label: t("home.stats.newThisMonth", "New this month"),
      color: "hsl(150 25% 45%)",
      bg: "hsl(150 25% 45% / 0.15)",
      border: "hsl(150 25% 45% / 0.2)",
    },
  ];

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[85vh] flex items-center">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt={t("home.heroImageAlt", "Open book with pen")}
            className="h-full w-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/75 to-background" />
        </div>

        {/* Decorative blurred orbs */}
        <div
          className="absolute top-20 right-[15%] w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "hsl(36 70% 50%)" }}
        />
        <div
          className="absolute bottom-32 right-[30%] w-48 h-48 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: "hsl(16 60% 52%)" }}
        />

        <div className="container relative mx-auto px-4 sm:px-6 pb-20 pt-16 md:pt-24 md:pb-28 w-full">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5"
            style={{ background: "hsl(36 70% 50% / 0.12)" }}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="font-ui text-xs font-medium text-primary">
              {t("home.readAcc", "Read freely, no account required")}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="max-w-4xl"
          >
            <h1
              className={cn(
                "text-5xl font-bold text-foreground sm:text-6xl md:text-7xl lg:text-[5rem]",
                isGeorgian
                  ? "font-ui leading-[1.25] tracking-normal md:leading-[1.2]"
                  : "font-display leading-[1.15] tracking-tight",
              )}
            >
              {t("home.hero.titleStart", "Words find")}
              <span className="ml-2 text-gradient-primary">{t("home.hero.titleHighlight", "their home")}</span>
            </h1>
            <p className="mt-6 font-body text-lg leading-relaxed text-muted-foreground md:text-xl max-w-2xl">
              {t(
                "home.authorsApprove",
                "Public pages are open to everyone. A reader account lets you leave ratings, likes, and comments. Authors publish after editorial approval.",
              )}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link to="/browse">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gap-3 font-ui font-semibold shadow-warm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 h-14 sm:h-14 px-10 text-base rounded-xl"
                >
                  <BookOpen className="h-5 w-5" />
                  {t("home.hero.browseCta", "Browse Library")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/register">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto gap-3 font-ui hover:bg-primary/5 hover:border-primary/40 transition-all duration-300 h-14 sm:h-14 px-10 text-base border-border/80 rounded-xl"
                >
                  <UserPlus className="h-5 w-5" />
                  {t("home.hero.joinCta", "Create Free Account")}
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats — glass pills */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-14 sm:mt-20 flex justify-between sm:justify-start gap-2 sm:gap-5"
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col sm:flex-row items-center sm:gap-3.5 rounded-xl sm:rounded-2xl border bg-background/40 backdrop-blur-md p-3 sm:px-5 sm:py-3.5 shadow-sm transition-transform hover:-translate-y-0.5 flex-1 sm:flex-none sm:min-w-[160px]"
                style={{ borderColor: stat.border }}
              >
                <div
                  className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl flex-shrink-0 mb-2 sm:mb-0"
                  style={{ background: stat.bg }}
                >
                  <stat.icon className="h-4 w-4 sm:h-4 sm:w-4" style={{ color: stat.color }} />
                </div>
                <div className="text-center sm:text-left">
                  <p className="font-display text-lg sm:text-2xl font-bold text-foreground leading-none">{stat.value}</p>
                  <p className="font-ui text-[10px] sm:text-xs font-medium text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── როგორ მუშაობს ─────────────────────────────── */}
      <section className="border-y border-border/40 bg-muted/30 py-20 md:py-28">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
              {t("home.howItWorksTitle", "How it Works")}
            </h2>
            <p className="mt-3 font-ui text-base text-muted-foreground">
              {t("home.howItWorksSubtitle", "Three ways to become part of Readus")}
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="group relative rounded-2xl border border-white/10 bg-background/80 backdrop-blur-sm p-8 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
              >
                <div
                  className="inline-flex h-14 w-14 items-center justify-center rounded-xl mb-5"
                  style={{ background: "hsl(36 70% 50% / 0.1)" }}
                >
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-2xl font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 font-ui text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── რჩეული ნაშრომები ────────────────────────────── */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-8"
          >
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
                {t("home.featuredTitle", "Featured Works")}
              </h2>
              <p className="mt-1 font-ui text-sm text-muted-foreground">
                {t("home.featuredSubtitle", "Recently approved and published works")}
              </p>
            </div>
            <Link to="/browse">
              <Button variant="ghost" className="gap-1.5 text-sm font-ui group">
                {t("home.featuredViewAll", "View all")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </motion.div>

          {worksQuery.isLoading ? (
            <div className="mt-8 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-xl border bg-card shadow-card overflow-hidden animate-pulse">
                  <div className="h-24 bg-muted" />
                  <div className="p-5 space-y-2">
                    <div className="h-3 bg-muted rounded w-1/3" />
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-12 bg-muted rounded mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {works.slice(0, 6).map((work, index) => (
                <WorkCard key={`${work.category}-${work.id}`} work={work} index={index} />
              ))}
            </div>
          )}

          {!worksQuery.isLoading && works.length === 0 ? (
            <p className="mt-8 text-center font-body text-sm text-muted-foreground">
              {t("home.noWorks", "No published works yet.")}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default PublicHomePage;

