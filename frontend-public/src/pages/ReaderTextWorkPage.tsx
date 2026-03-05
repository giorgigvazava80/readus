import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, EyeOff, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import EngagementPanel from "@/components/engagement/EngagementPanel";
import FollowAuthorButton from "@/components/FollowAuthorButton";
import ReadingFontSizeControl from "@/components/reader/ReadingFontSizeControl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildFacebookShareIntent, fetchContentDetail, fetchMyContinueReading, saveReadingProgress, saveReadingProgressKeepalive, trackContentView } from "@/lib/api";
import { authorProfilePath, resolveAuthorKey } from "@/lib/authors";
import { getStoredReadingFontSize, readingFontSizeClassByPreference, setStoredReadingFontSize, type ReadingFontSize } from "@/lib/fontSize";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { estimateReadTimeFromHtml } from "@/lib/content";
import { useSession } from "@/hooks/useSession";

interface ReaderTextWorkPageProps {
  type: "poems" | "stories";
}

const labels = {
  poems: "Poetry",
  stories: "Stories",
};

const listPath = {
  poems: "/poems",
  stories: "/stories",
};

const ReaderTextWorkPage = ({ type }: ReaderTextWorkPageProps) => {
  const { t } = useI18n();
  const { identifier } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const contentIdentifier = (identifier || "").trim();
  const [fontSize, setFontSize] = useState<ReadingFontSize>(() => getStoredReadingFontSize());
  const [liveProgress, setLiveProgress] = useState(0);
  const readingFontSizeClass = readingFontSizeClassByPreference[fontSize];
  const { me } = useSession();
  const categoryLabel = t(`dashboard.${type}`, labels[type]);
  const readTimeTemplate = t("reader.readTime", "{minutes} min read");

  const detailQuery = useQuery({
    queryKey: ["reader", type, contentIdentifier],
    queryFn: () => fetchContentDetail(type, contentIdentifier),
    enabled: Boolean(contentIdentifier),
  });

  useEffect(() => {
    if (!detailQuery.data?.public_slug || contentIdentifier === detailQuery.data.public_slug) {
      return;
    }
    const target = `/${type}/${detailQuery.data.public_slug}`;
    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [contentIdentifier, detailQuery.data?.public_slug, location.pathname, navigate, type]);

  const work = detailQuery.data ?? null;
  const continueReadingQuery = useQuery({
    queryKey: ["continue-reading-work", me?.id, type, work?.id],
    queryFn: () => fetchMyContinueReading(30),
    enabled: Boolean(me && work?.id),
  });

  const savedProgress = useMemo(() => {
    if (!work?.id) return 0;
    const match = (continueReadingQuery.data || []).find(
      (item) => item.work.id === work.id && !item.chapter,
    );
    return Number(match?.progress_percent || 0);
  }, [continueReadingQuery.data, work?.id]);

  const displayProgress = Math.max(liveProgress, savedProgress);
  const shareLink = useMemo(() => {
    if (!work) return window.location.href;
    const base = `${window.location.origin}/read/${type}/${work.public_slug || work.id}`;
    if (me?.username) {
      return `${base}?ref=${encodeURIComponent(`@${me.username}`)}`;
    }
    return base;
  }, [me?.username, type, work]);

  useEffect(() => {
    if (!work) return;
    const targetIdentifier = work.public_slug || contentIdentifier;

    const computeProgressPercent = () => {
      const doc = document.documentElement;
      const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
      return Math.max(0, Math.min(100, (window.scrollY / scrollable) * 100));
    };

    trackContentView(type, targetIdentifier).catch(() => undefined);

    const sendProgress = () => {
      const progressPercent = computeProgressPercent();
      setLiveProgress(progressPercent);
      if (!me) return;

      saveReadingProgress({
        work_id: work.id,
        work_type: type,
        progress_percent: Number(progressPercent.toFixed(2)),
        last_position: {
          scroll_y: Math.round(window.scrollY),
          route: location.pathname,
        },
      }).catch(() => undefined);
    };

    const handleBeforeUnload = () => {
      if (!me) return;
      const progressPercent = computeProgressPercent();
      saveReadingProgressKeepalive({
        work_id: work.id,
        work_type: type,
        progress_percent: Number(progressPercent.toFixed(2)),
        last_position: {
          scroll_y: Math.round(window.scrollY),
          route: location.pathname,
        },
      });
    };

    sendProgress();
    const intervalId = window.setInterval(sendProgress, 15000);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      sendProgress();
    };
  }, [contentIdentifier, location.pathname, me, type, work]);

  if (!contentIdentifier) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("reader.invalidLink", "Link is invalid.")}</p>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("common.loading", "Loading...")}</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto px-6 py-10 space-y-4">
        <p className="font-ui text-sm text-red-700">{t("reader.workLoadError", "Work not found.")}</p>
        <Link to={listPath[type]}>
          <Button variant="outline">
            {t("reader.backToList", "Back to {category}").replace("{category}", categoryLabel)}
          </Button>
        </Link>
      </div>
    );
  }
  const authorDisplay = work.author_name || work.author_username || t("workcard.anonymous", "anonymous");
  const authorPath = authorProfilePath(resolveAuthorKey(work));
  const handleReadingFontSizeChange = (next: ReadingFontSize) => {
    setStoredReadingFontSize(next);
    setFontSize(next);
  };

  return (
    <div className="container mx-auto w-full md:w-[85%] lg:w-[70%] xl:w-[60%] space-y-6 md:space-y-10 px-4 py-6 md:px-8 md:py-12">
      <section className="pb-4 border-b border-border/40">
        <div className="flex items-center gap-3 mb-4">
          <Link to={listPath[type]}>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground md:bg-secondary/50">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-ui text-xs md:text-sm uppercase tracking-wider text-muted-foreground truncate">{categoryLabel}</p>
            <h1 className="font-display text-2xl md:text-4xl font-semibold text-foreground truncate">{work.title}</h1>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          {work.is_hidden && (
            <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 gap-1.5 px-3 py-1">
              <EyeOff className="h-4 w-4" />
              {t("workcard.hidden", "Hidden from Public")}
            </Badge>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="font-ui text-sm text-muted-foreground">
            {t("workcard.by", "by ")}
            <Link to={authorPath} className="hover:text-primary hover:underline">
              {authorDisplay}
            </Link>
            {" - "}
            {estimateReadTimeFromHtml(work.body || work.extracted_text || work.description, readTimeTemplate)}
          </p>
          <FollowAuthorButton authorId={work.author_id} />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={async () => {
              await navigator.clipboard.writeText(shareLink);
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            Copy link
          </Button>
          <a href={buildFacebookShareIntent(shareLink)} target="_blank" rel="noreferrer">
            <Button size="sm">Share to Facebook</Button>
          </a>
        </div>
      </section>

      {displayProgress > 0 && displayProgress < 100 ? (
        <div className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-card">
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-primary to-accent transition-all"
              style={{ width: `${Math.max(1, Math.min(100, displayProgress))}%` }}
            />
          </div>
          <p className="mt-2 font-ui text-xs text-muted-foreground">
            Progress: {displayProgress.toFixed(0)}%
          </p>
        </div>
      ) : null}

      <ReadingFontSizeControl value={fontSize} onChange={handleReadingFontSizeChange} />

      <div className={cn("transition-all duration-300 md:rounded-2xl md:border md:border-border/40 md:bg-card/30 md:p-8 md:shadow-sm", readingFontSizeClass)}>
        {work.description ? (
          <section className="reader-html prose-literary mb-8 text-foreground/85" dangerouslySetInnerHTML={{ __html: work.description }} />
        ) : null}

        <article className="text-foreground/90">
          {work.body ? (
            <div className="reader-html prose-literary w-full" dangerouslySetInnerHTML={{ __html: work.body }} />
          ) : work.extracted_text ? (
            <pre className="prose-literary whitespace-pre-wrap">{work.extracted_text}</pre>
          ) : (
            <p className="font-ui text-sm text-muted-foreground">{t("reader.noTextAvailable", "Text is not available.")}</p>
          )}
        </article>
      </div>

      <EngagementPanel category={type} identifier={work.public_slug || work.id} />
    </div>
  );
};

export default ReaderTextWorkPage;
