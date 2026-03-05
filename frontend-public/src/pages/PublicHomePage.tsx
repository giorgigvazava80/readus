import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Feather, Users, Sparkles, Eye, UserPlus, PenTool, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import WorkCard, { type PublicWorkCardItem } from "@/components/WorkCard";
import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/i18n";
import { resolveAuthorKey } from "@/lib/authors";
import { fetchContent, fetchMyContinueReading, fetchRecommendations, fetchTrending, resolveMediaUrl } from "@/lib/api";
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

/* ── Compact cover card for trending/recommended carousels ── */
interface TrendItem {
  id: number;
  category: string;
  title: string;
  read_path: string;
  cover_image?: string | null;
  explain_reason?: string;
  score?: number;
}

const coverPalette = [
  "hsl(24,60%,50%)", "hsl(215,40%,45%)", "hsl(150,25%,45%)",
  "hsl(32,50%,48%)", "hsl(228,35%,50%)", "hsl(14,55%,52%)",
];

function normalizeCategoryTag(rawCategory: string, t: (key: string, fallback?: string) => string): string {
  const category = String(rawCategory || "").trim().toLowerCase();
  if (category === "book" || category === "books") return t("category.book", "Book");
  if (category === "story" || category === "stories") return t("category.story", "Story");
  if (category === "poem" || category === "poems") return t("category.poem", "Poem");
  if (category === "chapter" || category === "chapters") return t("category.chapter", "Chapter");
  return rawCategory;
}

function TrendCard({ item, index, accent }: { item: TrendItem; index: number; accent?: string }) {
  const { t } = useI18n();
  const coverColor = coverPalette[item.id % coverPalette.length];
  const coverUrl = resolveMediaUrl(item.cover_image);

  return (
    <Link
      to={item.read_path}
      style={{ touchAction: "manipulation" }}
      className="snap-card block w-28 sm:w-36 flex-shrink-0 focus:outline-none group"
    >
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-border/30 shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-300">
        {coverUrl ? (
          <img src={coverUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${coverColor}cc, ${coverColor})` }} />
        )}
        {/* Scrim */}
        <div className="cover-scrim absolute inset-0" />
        {/* Category pill */}
        <span
          className="absolute top-1.5 left-1.5 text-[9px] font-ui font-bold uppercase tracking-wider text-white/90 bg-black/30 backdrop-blur-sm rounded-full px-1.5 py-0.5"
          style={accent ? { color: accent } : undefined}
        >
          {normalizeCategoryTag(item.category, t)}
        </span>
        {/* Title overlay */}
        <p className="absolute bottom-0 left-0 right-0 p-2 font-display font-bold text-white text-[11px] sm:text-xs leading-tight line-clamp-3 drop-shadow-sm">
          {item.title}
        </p>
        {/* Rank badge for trending */}
        <span className="absolute top-1.5 right-1.5 text-[10px] font-ui font-black text-white/60 leading-none">
          #{index + 1}
        </span>
      </div>
    </Link>
  );
}

function RecommendCard({ item }: { item: TrendItem }) {
  const coverColor = coverPalette[item.id % coverPalette.length];
  const coverUrl = resolveMediaUrl(item.cover_image);

  return (
    <Link
      to={item.read_path}
      style={{ touchAction: "manipulation" }}
      className="snap-card block w-28 sm:w-36 flex-shrink-0 focus:outline-none group"
    >
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-border/30 shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-300">
        {coverUrl ? (
          <img src={coverUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${coverColor}cc, ${coverColor})` }} />
        )}
        <div className="cover-scrim absolute inset-0" />
        <span className="absolute top-1.5 right-1.5">
          <Sparkles className="h-3 w-3 text-primary drop-shadow-sm" />
        </span>
        <p className="absolute bottom-0 left-0 right-0 p-2 font-display font-bold text-white text-[11px] sm:text-xs leading-tight line-clamp-3 drop-shadow-sm">
          {item.title}
        </p>
      </div>
      {item.explain_reason && (
        <p className="mt-1 font-ui text-[10px] text-muted-foreground line-clamp-2 leading-tight">{item.explain_reason}</p>
      )}
    </Link>
  );
}

/* ── Skeleton loader for carousels ── */
function CarouselSkeleton() {
  return (
    <div className="flex gap-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="w-28 sm:w-36 flex-shrink-0 aspect-[2/3] rounded-xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}

/* ── Section header ── */
function DesktopCarouselControls({
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="hidden lg:flex items-center gap-1.5">
      <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label={prevLabel} title={prevLabel} onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label={nextLabel} title={nextLabel} onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SectionHeader({
  title,
  linkTo,
  linkLabel,
  controls,
}: {
  title: string;
  linkTo?: string;
  linkLabel?: string;
  controls?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-3 sm:mb-4">
      <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
      <div className="flex items-center gap-2">
        {controls}
        {linkTo && linkLabel && (
          <Link to={linkTo}>
            <Button variant="ghost" size="sm" className="gap-1 text-xs sm:text-sm font-ui group">
              {linkLabel}
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════ */
const PublicHomePage = () => {
  const { t, language } = useI18n();
  const { me } = useSession();
  const isGeorgian = language === "ka";
  const locale = language === "ka" ? "ka-GE" : "en-US";
  const georgianAccentWord = t("home.hero.titleAccentWord", "წერე");
  const excerptFallback = t("home.excerptUnavailable", "Excerpt is not available yet.");
  const readTimeTemplate = t("home.readTime", "{minutes} min read");
  const georgianHighlightText = t("home.hero.titleHighlight", "და წერე ჩვენთან ერთად");
  const georgianHighlightParts = isGeorgian ? georgianHighlightText.split(georgianAccentWord) : [];
  const trendingTodayRef = useRef<HTMLDivElement>(null);
  const trendingWeekRef = useRef<HTMLDivElement>(null);
  const recommendationsRef = useRef<HTMLDivElement>(null);

  const scrollRow = (rowRef: React.RefObject<HTMLDivElement>, direction: "left" | "right") => {
    const element = rowRef.current;
    if (!element) return;
    const offset = Math.max(280, Math.round(element.clientWidth * 0.75));
    element.scrollBy({
      left: direction === "left" ? -offset : offset,
      behavior: "smooth",
    });
  };

  const steps = [
    {
      step: "01",
      icon: Eye,
      title: t("home.step1.title", "Read Publicly"),
      desc: t("home.step1.desc", "Anyone can read approved books, stories, and poetry without creating an account."),
    },
    {
      step: "02",
      icon: UserPlus,
      title: t("home.step2.title", "Join as Reader"),
      desc: t("home.step2.desc", "Create a reader account to leave ratings, likes, comments, bookmarks, and track activity."),
    },
    {
      step: "03",
      icon: PenTool,
      title: t("home.step3.title", "Become a Writer"),
      desc: t("home.step3.desc", "Submit a writer application with a sample. After approval, you can submit and manage publications."),
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

  const continueReadingQuery = useQuery({
    queryKey: ["continue-reading", me?.id, 10],
    queryFn: () => fetchMyContinueReading(10),
    enabled: Boolean(me),
  });

  const trendingTodayQuery = useQuery({
    queryKey: ["home-trending", "today"],
    queryFn: () => fetchTrending("today", 12),
  });

  const trendingWeekQuery = useQuery({
    queryKey: ["home-trending", "week"],
    queryFn: () => fetchTrending("week", 12),
  });

  const recommendationsQuery = useQuery({
    queryKey: ["home-recommendations", me?.id],
    queryFn: () => fetchRecommendations(12),
    enabled: Boolean(me),
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
    {
      icon: BookOpen,
      value: `${publishedCount}+`,
      label: t("home.stats.published", "Published works"),
      color: "hsl(24 60% 55%)",
      bg: "hsl(24 60% 55% / 0.15)",
      border: "hsl(24 60% 55% / 0.2)",
    },
    {
      icon: Users,
      value: `${authorsCount}+`,
      label: t("home.stats.authors", "Authors"),
      color: "hsl(215 40% 45%)",
      bg: "hsl(215 40% 45% / 0.15)",
      border: "hsl(215 40% 45% / 0.2)",
    },
    {
      icon: Feather,
      value: `${newThisMonth}+`,
      label: t("home.stats.newThisMonth", "New this month"),
      color: "hsl(150 25% 45%)",
      bg: "hsl(150 25% 45% / 0.15)",
      border: "hsl(150 25% 45% / 0.2)",
    },
  ];

  const hasTrendingToday = (trendingTodayQuery.data?.length ?? 0) > 0;
  const hasTrendingWeek = (trendingWeekQuery.data?.length ?? 0) > 0;
  const hasRecommendations = me && (recommendationsQuery.data?.length ?? 0) > 0;
  const hasContinue = me && (continueReadingQuery.data?.length ?? 0) > 0;

  return (
    <div>
      {!me && (
        <>
          {/* ── Hero ─────────────────────────────────────── */}
          <section className="relative overflow-hidden min-h-[100svh] sm:min-h-[85vh] flex items-center">
            <div className="absolute inset-0">
              <img
                src={heroImage}
                alt={t("home.heroImageAlt", "Open book with pen")}
                className="h-full w-full object-cover opacity-20"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/75 to-background" />
            </div>

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
                className="mb-6 sm:mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5"
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
                    "font-bold text-foreground",
                    isGeorgian
                      ? "font-body text-4xl leading-[1.22] tracking-normal sm:text-5xl md:text-6xl lg:text-[4.4rem]"
                      : "font-display text-5xl leading-[1.15] tracking-tight sm:text-6xl md:text-7xl lg:text-[5rem]",
                  )}
                >
                  {isGeorgian ? (
                    <>
                      <span className="block text-primary">{t("home.hero.titleStart", "წაიკითხე")}</span>
                      <span className="mt-1 block text-foreground">
                        {georgianHighlightParts[0] || ""}
                        <span className="text-primary">{georgianAccentWord}</span>
                        {georgianHighlightParts[1] || ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>{t("home.hero.titleStart", "Words find")}</span>
                      <span className="ml-2 text-gradient-primary">{t("home.hero.titleHighlight", "their home")}</span>
                    </>
                  )}
                </h1>
                <p className="mt-4 sm:mt-6 font-body text-base sm:text-lg leading-relaxed text-muted-foreground md:text-xl max-w-2xl">
                  {t(
                    "home.authorsApprove",
                    "Public pages are open to everyone. A reader account lets you leave ratings, likes, and comments. Authors publish after editorial approval.",
                  )}
                </p>

                {/* CTAs — stacked on mobile, row on sm+ */}
                <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <Link to="/browse" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto gap-3 font-ui font-semibold shadow-warm hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-14 px-8 text-base rounded-xl"
                    >
                      <BookOpen className="h-5 w-5" />
                      {t("home.hero.browseCta", "Browse Library")}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  {!me && (
                    <Link to="/register" className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto gap-3 font-ui hover:bg-primary/5 hover:border-primary/40 active:scale-[0.98] transition-all duration-300 h-14 px-8 text-base border-border/80 rounded-xl"
                      >
                        <UserPlus className="h-5 w-5" />
                        {t("home.hero.joinCta", "Create Free Account")}
                      </Button>
                    </Link>
                  )}
                </div>
              </motion.div>

              {/* Stats pills */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="mt-12 sm:mt-20 flex justify-between sm:justify-start gap-2 sm:gap-5"
              >
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex flex-col sm:flex-row items-center sm:gap-3.5 rounded-xl sm:rounded-2xl border bg-background/40 backdrop-blur-md p-3 sm:px-5 sm:py-3.5 shadow-sm flex-1 sm:flex-none sm:min-w-[160px]"
                    style={{ borderColor: stat.border }}
                  >
                    <div
                      className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl flex-shrink-0 mb-2 sm:mb-0"
                      style={{ background: stat.bg }}
                    >
                      <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
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

          {/* ── How it Works ── */}
          <section className="border-y border-border/40 bg-muted/30 py-16 md:py-24">
            <div className="container mx-auto px-4 sm:px-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="text-center mb-12"
              >
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground md:text-4xl">
                  {t("home.howItWorksTitle", "How it Works")}
                </h2>
                <p className="mt-3 font-ui text-base text-muted-foreground">
                  {t("home.howItWorksSubtitle", "Three ways to become part of Readus")}
                </p>
              </motion.div>

              <div className="grid gap-6 md:grid-cols-3">
                {steps.map((item, i) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.15 }}
                    className="group relative rounded-2xl border border-white/10 bg-background/80 backdrop-blur-sm p-6 sm:p-8 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
                  >
                    <div
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                      style={{ background: "hsl(36 70% 50% / 0.1)" }}
                    >
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 font-ui text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── Discovery section: carousels + featured grid ── */}
      <section className="py-8 md:py-12 bg-background">
        <div className="container mx-auto px-4 sm:px-6 space-y-10 md:space-y-14">

          {/* Continue Reading */}
          {hasContinue && (
            <div>
              <SectionHeader
                title={t("home.continueReading", "Continue Reading")}
                linkTo="/dashboard"
                linkLabel={t("home.openDashboard", "Open dashboard")}
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {continueReadingQuery.data!.slice(0, 6).map((item) => {
                  // Build the correct read path
                  // For books with chapters, use /read/books/{slug}/{page}
                  let readPath = item.target_read_path;
                  if (item.work_type === "books" && item.chapter && item.last_position) {
                    const slug = item.work.identifier || item.work.id;
                    const page = (item.last_position as Record<string, unknown>).page;
                    if (page && Number(page) > 0) {
                      readPath = `/read/books/${slug}/${page}`;
                    } else {
                      readPath = `/read/books/${slug}`;
                    }
                  }

                  return (
                    <Link
                      key={item.id}
                      to={readPath}
                      className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-card transition-all hover:border-primary/40 hover:-translate-y-0.5 group"
                      style={{ touchAction: "manipulation" }}
                    >
                      <p className="font-ui text-[10px] uppercase tracking-wide text-muted-foreground">
                        {item.chapter ? t("home.chapter", "Chapter") : normalizeCategoryTag(item.work.category, t)}
                      </p>
                      <h3 className="mt-1 font-display text-base sm:text-lg text-foreground group-hover:text-primary transition-colors">
                        {item.chapter ? item.chapter.title : item.work.title}
                      </h3>
                      <p className="mt-0.5 font-ui text-xs text-muted-foreground">{item.work.title}</p>
                      {/* Progress bar */}
                      <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Number(item.progress_percent))}%`,
                            background: "var(--hero-gradient)",
                          }}
                        />
                      </div>
                      <p className="mt-1 font-ui text-[10px] text-muted-foreground">
                        {Number(item.progress_percent).toFixed(0)}% {t("home.complete", "complete")}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trending Today */}
          {(trendingTodayQuery.isLoading || hasTrendingToday) && (
            <div>
              <SectionHeader
                title={t("home.trendingToday", "Trending Today")}
                controls={
                  trendingTodayQuery.isLoading ? undefined : (
                    <DesktopCarouselControls
                      onPrev={() => scrollRow(trendingTodayRef, "left")}
                      onNext={() => scrollRow(trendingTodayRef, "right")}
                      prevLabel={t("home.carouselPrev", "Scroll left")}
                      nextLabel={t("home.carouselNext", "Scroll right")}
                    />
                  )
                }
              />
              {trendingTodayQuery.isLoading ? (
                <CarouselSkeleton />
              ) : (
                <div ref={trendingTodayRef} className="flex overflow-x-auto gap-3 pb-3 snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
                  {trendingTodayQuery.data!.slice(0, 12).map((item, i) => (
                    <TrendCard key={`${item.category}-${item.id}`} item={item} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trending This Week */}
          {(trendingWeekQuery.isLoading || hasTrendingWeek) && (
            <div>
              <SectionHeader
                title={t("home.trendingWeek", "Trending This Week")}
                controls={
                  trendingWeekQuery.isLoading ? undefined : (
                    <DesktopCarouselControls
                      onPrev={() => scrollRow(trendingWeekRef, "left")}
                      onNext={() => scrollRow(trendingWeekRef, "right")}
                      prevLabel={t("home.carouselPrev", "Scroll left")}
                      nextLabel={t("home.carouselNext", "Scroll right")}
                    />
                  )
                }
              />
              {trendingWeekQuery.isLoading ? (
                <CarouselSkeleton />
              ) : (
                <div ref={trendingWeekRef} className="flex overflow-x-auto gap-3 pb-3 snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
                  {trendingWeekQuery.data!.slice(0, 12).map((item, i) => (
                    <TrendCard key={`${item.category}-${item.id}`} item={item} index={i} accent="hsl(36 70% 65%)" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recommended for You */}
          {(recommendationsQuery.isLoading || hasRecommendations) && (
            <div>
              <SectionHeader
                title={t("home.recommended", "Recommended for You")}
                controls={
                  recommendationsQuery.isLoading ? undefined : (
                    <DesktopCarouselControls
                      onPrev={() => scrollRow(recommendationsRef, "left")}
                      onNext={() => scrollRow(recommendationsRef, "right")}
                      prevLabel={t("home.carouselPrev", "Scroll left")}
                      nextLabel={t("home.carouselNext", "Scroll right")}
                    />
                  )
                }
              />
              {recommendationsQuery.isLoading ? (
                <CarouselSkeleton />
              ) : (
                <div ref={recommendationsRef} className="flex overflow-x-auto gap-3 pb-3 snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
                  {recommendationsQuery.data!.slice(0, 12).map((item) => (
                    <RecommendCard key={`${item.category}-${item.id}`} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Featured Works grid ── */}
      <section className="pb-6 md:pb-12 pt-0">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-6"
          >
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground md:text-3xl">
                {t("home.featuredTitle", "Featured Works")}
              </h2>
              <p className="mt-1 font-ui text-sm text-muted-foreground">
                {t("home.featuredSubtitle", "Recently approved and published works")}
              </p>
            </div>
            <Link to="/browse">
              <Button variant="ghost" size="sm" className="gap-1.5 text-sm font-ui group">
                {t("home.featuredViewAll", "View all")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </motion.div>

          {worksQuery.isLoading ? (
            <div className="grid gap-3 sm:gap-5 grid-cols-3 sm:grid-cols-3 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-5 grid-cols-3 sm:grid-cols-3 lg:grid-cols-6">
              {works.slice(0, 6).map((work, index) => (
                <WorkCard key={`${work.category}-${work.id}`} work={work} index={index} />
              ))}
            </div>
          )}

          {!worksQuery.isLoading && works.length === 0 && (
            <p className="mt-8 text-center font-body text-sm text-muted-foreground">
              {t("home.noWorks", "No published works yet.")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default PublicHomePage;
