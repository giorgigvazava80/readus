import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/i18n";
import {
  buildFacebookShareIntent,
  fetchWriterAnalyticsOverview,
  fetchWriterAnalyticsWorks,
} from "@/lib/api";
import { Button } from "@/components/ui/button";

type RangeKey = "7d" | "30d" | "all";
type SortKey = "views" | "likes" | "comments" | "completions";

const ranges: Array<{ key: RangeKey }> = [
  { key: "7d" },
  { key: "30d" },
  { key: "all" },
];

const sorts: Array<{ key: SortKey }> = [
  { key: "views" },
  { key: "likes" },
  { key: "comments" },
  { key: "completions" },
];

const WriterAnalyticsPage = () => {
  const { t } = useI18n();
  const { me } = useSession();
  const [range, setRange] = useState<RangeKey>("7d");
  const [sort, setSort] = useState<SortKey>("views");

  const overviewQuery = useQuery({
    queryKey: ["writer-analytics-overview", range],
    queryFn: () => fetchWriterAnalyticsOverview(range),
  });
  const worksQuery = useQuery({
    queryKey: ["writer-analytics-works", range, sort],
    queryFn: () => fetchWriterAnalyticsWorks({ range, sort }),
  });

  const inviteRef = useMemo(() => (me?.username ? `@${me.username}` : ""), [me?.username]);
  const inviteLink = useMemo(() => {
    const base = `${window.location.origin}/browse`;
    return inviteRef ? `${base}?ref=${encodeURIComponent(inviteRef)}` : base;
  }, [inviteRef]);

  if (overviewQuery.isLoading || worksQuery.isLoading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("analytics.loading", "Loading analytics...")}</p>
      </div>
    );
  }

  if (overviewQuery.isError || worksQuery.isError || !overviewQuery.data || !worksQuery.data) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p className="font-ui text-sm text-red-700">{t("analytics.error", "Could not load analytics.")}</p>
      </div>
    );
  }

  const overview = overviewQuery.data;
  const works = worksQuery.data.results || [];

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">{t("analytics.title", "Writer Analytics")}</h1>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            {t("analytics.subtitle", "Views, unique readers, likes, comments, completions, follower growth, and share-attributed reads.")}
          </p>
        </div>
        <div className="flex gap-2">
          {ranges.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={range === item.key ? "default" : "outline"}
              onClick={() => setRange(item.key)}
            >
              {t(`analytics.ranges.${item.key}` as any, (() => { switch (item.key) { case "7d": return "7 days"; case "30d": return "30 days"; case "all": return "All time"; default: return ""; } })())}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl text-foreground">{t("analytics.inviteReaders", "Invite Readers")}</p>
            <p className="font-ui text-xs text-muted-foreground">
              {t("analytics.inviteDesc", "Share your referral link to grow your first 100 reads.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteLink);
              }}
            >
              {t("analytics.copyLink", "Copy link")}
            </Button>
            <a href={buildFacebookShareIntent(inviteLink)} target="_blank" rel="noreferrer">
              <Button>{t("analytics.shareFacebook", "Share to Facebook")}</Button>
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card/80 p-4">
          <p className="font-ui text-xs uppercase tracking-wide text-muted-foreground">{t("analytics.metrics.views", "Views")}</p>
          <p className="mt-1 font-display text-2xl text-foreground">{overview.metrics.views}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/80 p-4">
          <p className="font-ui text-xs uppercase tracking-wide text-muted-foreground">{t("analytics.metrics.uniqueReaders", "Unique readers")}</p>
          <p className="mt-1 font-display text-2xl text-foreground">{overview.metrics.unique_readers}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/80 p-4">
          <p className="font-ui text-xs uppercase tracking-wide text-muted-foreground">{t("analytics.metrics.readsFromShares", "Reads from shares")}</p>
          <p className="mt-1 font-display text-2xl text-foreground">{overview.reads_from_shares}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/80 p-4">
          <p className="font-ui text-xs uppercase tracking-wide text-muted-foreground">{t("analytics.metrics.followerGrowth", "Follower growth")}</p>
          <p className="mt-1 font-display text-2xl text-foreground">{overview.follower_growth}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-ui text-sm text-muted-foreground">{t("analytics.sortWorksBy", "Sort works by:")}</span>
        {sorts.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={sort === item.key ? "default" : "outline"}
            onClick={() => setSort(item.key)}
          >
            {t(`analytics.sorts.${item.key}` as any, (() => { switch (item.key) { case "views": return "Views"; case "likes": return "Likes"; case "comments": return "Comments"; case "completions": return "Completions"; default: return ""; } })())}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {works.map((row) => (
          <div key={`${row.work.category}-${row.work.id}`} className="rounded-xl border border-border/60 bg-card/80 p-4">
            <p className="font-ui text-xs uppercase tracking-wide text-muted-foreground">{t(`category.${row.work.category}` as keyof typeof t, row.work.category)}</p>
            <h2 className="mt-1 font-display text-2xl text-foreground">{row.work.title}</h2>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm md:grid-cols-6">
              <p className="font-ui text-muted-foreground">{t("analytics.work.views", "Views: {count}").replace("{count}", String(row.metrics.views))}</p>
              <p className="font-ui text-muted-foreground">{t("analytics.work.readers", "Readers: {count}").replace("{count}", String(row.metrics.unique_readers))}</p>
              <p className="font-ui text-muted-foreground">{t("analytics.work.likes", "Likes: {count}").replace("{count}", String(row.metrics.likes))}</p>
              <p className="font-ui text-muted-foreground">{t("analytics.work.comments", "Comments: {count}").replace("{count}", String(row.metrics.comments))}</p>
              <p className="font-ui text-muted-foreground">{t("analytics.work.completions", "Completions: {count}").replace("{count}", String(row.metrics.completions))}</p>
              <p className="font-ui text-muted-foreground">{t("analytics.work.avgProgress", "Avg progress: {percent}%").replace("{percent}", String(row.metrics.avg_progress.toFixed(1)))}</p>
            </div>

            {row.chapters.length ? (
              <div className="mt-4 space-y-2 border-t border-border/40 pt-3">
                {row.chapters.map((chapterRow) => (
                  <div key={chapterRow.chapter.id} className="rounded-lg border border-border/50 bg-background/60 p-3">
                    <p className="font-ui text-sm font-medium text-foreground">
                      {chapterRow.chapter.title}
                    </p>
                    <p className="mt-1 font-ui text-xs text-muted-foreground">
                      {t("analytics.chapter.stats", "Views {views} · Readers {readers} · Likes {likes} · Comments {comments}")
                        .replace("{views}", String(chapterRow.metrics.views))
                        .replace("{readers}", String(chapterRow.metrics.unique_readers))
                        .replace("{likes}", String(chapterRow.metrics.likes))
                        .replace("{comments}", String(chapterRow.metrics.comments))}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WriterAnalyticsPage;
