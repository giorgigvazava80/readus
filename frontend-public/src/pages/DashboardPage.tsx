import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BookOpenText,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Feather,
  PlusSquare,
  ShieldAlert,
  UserCircle2,
  XCircle,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/i18n";
import { buildFacebookShareIntent, fetchContent, fetchMyWriterApplications, fetchNotifications, fetchWriterAnalyticsOverview, logout } from "@/lib/api";

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const statusConfig = {
  approved: { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-700", bg: "bg-emerald-500/10 border-emerald-500/30" },
  rejected: { icon: <XCircle className="h-4 w-4" />, color: "text-red-700", bg: "bg-red-500/10 border-red-500/30" },
  pending: { icon: <Clock className="h-4 w-4" />, color: "text-amber-700", bg: "bg-amber-500/10 border-amber-500/30" },
  canceled: { icon: <XCircle className="h-4 w-4" />, color: "text-slate-700", bg: "bg-slate-500/10 border-slate-500/30" },
};

const workCardConfig = [
  { key: "books", labelKey: "dashboard.books", defaultLabel: "Books", icon: "📚", href: "/my-works?cat=books" },
  { key: "chapters", labelKey: "dashboard.chapters", defaultLabel: "Chapters", icon: "📖", href: "/my-works?cat=chapters" },
  { key: "poems", labelKey: "dashboard.poems", defaultLabel: "Poems", icon: "🖋️", href: "/my-works?cat=poems" },
  { key: "stories", labelKey: "dashboard.stories", defaultLabel: "Stories", icon: "📝", href: "/my-works?cat=stories" },
];

const DashboardPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { me } = useSession();
  const { t } = useI18n();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const writerApplicationQuery = useQuery({
    queryKey: ["writer-applications", "mine", 1],
    queryFn: () => fetchMyWriterApplications(1),
    enabled: Boolean(me && !me.is_writer_approved),
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", 1],
    queryFn: () => fetchNotifications(1),
    enabled: Boolean(me),
  });

  const worksSummaryQuery = useQuery({
    queryKey: ["dashboard", "works-summary"],
    queryFn: async () => {
      const [books, chapters, poems, stories] = await Promise.all([
        fetchContent("books", { mine: true, page: 1 }),
        fetchContent("chapters", { mine: true, page: 1 }),
        fetchContent("poems", { mine: true, page: 1 }),
        fetchContent("stories", { mine: true, page: 1 }),
      ]);
      return { books: books.count, chapters: chapters.count, poems: poems.count, stories: stories.count };
    },
    enabled: Boolean(me),
  });

  const writerGrowthQuery = useQuery({
    queryKey: ["writer-growth-widget", me?.id],
    queryFn: () => fetchWriterAnalyticsOverview("7d"),
    enabled: Boolean(me?.is_writer_approved),
  });

  const latestApplication = writerApplicationQuery.data?.results?.[0];
  const isWriterRole = Boolean(me?.is_writer_approved || me?.role_registered === "writer");

  useEffect(() => {
    if (latestApplication?.status === "approved" && me && !me.is_writer_approved) {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  }, [latestApplication?.status, me, queryClient]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
    navigate("/", { replace: true });
  };

  const roleLabel = me ? t(`role.${me.effective_role}`, me.effective_role) : "";

  return (
    <div className="container mx-auto space-y-6 px-4 py-8 sm:px-6 sm:py-10 pb-20 md:pb-10">

      {/* Hero welcome section */}
      <section className="relative rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card backdrop-blur-sm sm:p-7">
        {me ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="absolute right-4 top-4 gap-1.5 font-ui xl:hidden sm:right-6 sm:top-6"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{isLoggingOut ? "..." : t("nav.logout", "Logout")}</span>
          </Button>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1">
              <UserCircle2 className="h-4 w-4 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">{t("dashboard.workspace", "Personal Workspace")}</span>
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
              {t("dashboard.greeting", "Hello")}, <span className="text-primary">{me?.username}</span> 👋
            </h1>
            <p className="mt-1.5 font-ui text-sm text-muted-foreground">
              {t("dashboard.signedInAs", "Signed in as")}{" "}
              <span className="font-medium text-foreground">{roleLabel}</span>
            </p>
          </div>

          <div className="flex flex-col w-full md:flex-row md:w-auto gap-3">
            {me?.is_writer_approved ? (
              <Link to="/writer/new" className="w-full md:w-auto">
                <Button className="gap-2 h-11 font-ui">
                  <PlusSquare className="h-4 w-4" />
                  {t("dashboard.newWork", t("work.newWork"))}
                </Button>
              </Link>
            ) : (
              <Link to="/writer-application" className="w-full md:w-auto">
                <Button className="gap-2 h-11 font-ui">
                  <Feather className="h-4 w-4" />
                  {t("dashboard.writerApplication", "Apply as Writer")}
                </Button>
              </Link>
            )}
            <Link to="/following" className="w-full md:w-auto">
              <Button variant="outline" className="w-full h-11 font-ui">{t("nav.following", "Following")}</Button>
            </Link>
            {isWriterRole ? (
              <Link to="/my-works" className="w-full md:w-auto">
                <Button variant="outline" className="w-full h-11 font-ui">{t("nav.myWorks", "My Works")}</Button>
              </Link>
            ) : null}
            <Link to="/settings" className="w-full md:w-auto">
              <Button variant="outline" className="w-full h-11 font-ui">{t("nav.settings", "Settings")}</Button>
            </Link>
          </div>
        </div>

        {/* Alerts */}
        {!me?.is_email_verified && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <span className="text-xl">📧</span>
            <div>
              <p className="font-ui text-sm font-medium text-amber-800">{t("dashboard.verifyEmailTitle", "Verify your email")}</p>
              <p className="font-ui text-xs text-amber-700 mt-0.5">{t("dashboard.verifyEmail", "Verify your email before using protected features.")}</p>
            </div>
          </div>
        )}
        {me?.forced_password_change && (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <span className="text-xl">🔒</span>
            <p className="font-ui text-sm text-red-700">{t("dashboard.forcePassword", "Password change is required before continuing.")}</p>
          </div>
        )}
      </section>

      {/* Stats grid */}
      {isWriterRole ? (
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {workCardConfig.map((item) => {
            const value = worksSummaryQuery.data?.[item.key as keyof typeof worksSummaryQuery.data] ?? 0;
            return (
              <Link key={item.key} to={item.href}>
                <div className="group rounded-xl border border-border/70 bg-card/80 p-5 shadow-card transition-all hover:border-primary/40 hover:shadow-md cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{item.icon}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-3 font-display text-3xl font-semibold text-foreground">
                    {worksSummaryQuery.isLoading ? "—" : value}
                  </p>
                  <p className="mt-1 font-ui text-xs uppercase tracking-wide text-muted-foreground">
                    {t(item.labelKey, item.defaultLabel)}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      ) : null}

      {/* Writer application status */}
      {!me?.is_writer_approved && (
        <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card sm:p-7">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold text-foreground">{t("dashboard.writerStatus", "Writer Application Status")}</h2>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-0 mb-5">
            {[
              { label: "Apply", done: Boolean(latestApplication) },
              { label: "Under review", done: latestApplication?.status === "approved" || latestApplication?.status === "rejected" || latestApplication?.status === "canceled" },
              { label: "Approved", done: latestApplication?.status === "approved" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 font-ui text-xs font-semibold transition-all ${step.done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
                    }`}>
                    {step.done ? "✓" : i + 1}
                  </div>
                  <span className="mt-1 font-ui text-[10px] text-muted-foreground text-center leading-tight max-w-[60px]">{step.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`mx-1 h-0.5 flex-1 mb-5 transition-all ${step.done ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>

          {latestApplication ? (
            <div className="rounded-xl border border-border/70 bg-background/70 p-4 font-ui text-sm">
              <div className="flex items-center gap-2">
                {statusConfig[latestApplication.status as keyof typeof statusConfig] && (
                  <span className={statusConfig[latestApplication.status as keyof typeof statusConfig].color}>
                    {statusConfig[latestApplication.status as keyof typeof statusConfig].icon}
                  </span>
                )}
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusConfig[latestApplication.status as keyof typeof statusConfig]?.bg || "border-border bg-muted text-foreground"
                  }`}>
                  {t(`status.${latestApplication.status}`, latestApplication.status)}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  Submitted {timeAgo(latestApplication.created_at)}
                </span>
              </div>
              {latestApplication.review_comment && (
                <p className="mt-3 rounded-lg border border-border/70 bg-card/80 p-3 text-foreground">
                  💬 {t("dashboard.reviewerComment", "Reviewer comment")}: {latestApplication.review_comment}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 bg-background/65 p-6 text-center">
              <Feather className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="font-ui text-sm text-muted-foreground">
                {t("dashboard.noWriterApp", "No writer application yet.")}
              </p>
              <Link to="/writer-application" className="mt-3 inline-block">
                <Button size="sm" className="gap-2 mt-2">
                  <Feather className="h-4 w-4" />
                  Submit Application
                </Button>
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Writer mode CTA */}
      {me?.is_writer_approved && (
        <section className="rounded-2xl border border-border/70 bg-gradient-to-r from-primary/10 via-card/80 to-accent/10 p-6 shadow-card sm:p-7">
          <div className="flex items-center gap-2">
            <Feather className="h-5 w-5 text-primary" />
            <p className="font-display text-xl font-semibold text-foreground">{t("dashboard.writerMode", "Writer mode active")}</p>
          </div>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            {t("dashboard.writerModeDesc", "You are approved as writer. Start publishing books from your writer workspace.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/writer/new">
              <Button className="gap-2">{t("dashboard.newWork", t("work.newWork"))}</Button>
            </Link>
            <Link to="/my-works">
              <Button variant="outline">{t("nav.myWorks", "My Works")}</Button>
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-border/50 bg-background/70 p-3">
              <p className="font-ui text-[11px] uppercase tracking-wide text-muted-foreground">Reads today</p>
              <p className="mt-1 font-display text-xl text-foreground">
                {writerGrowthQuery.data?.reads_today ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/70 p-3">
              <p className="font-ui text-[11px] uppercase tracking-wide text-muted-foreground">Reads 7d</p>
              <p className="mt-1 font-display text-xl text-foreground">
                {writerGrowthQuery.data?.reads_7d ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/70 p-3">
              <p className="font-ui text-[11px] uppercase tracking-wide text-muted-foreground">From shares</p>
              <p className="mt-1 font-display text-xl text-foreground">
                {writerGrowthQuery.data?.reads_from_shares ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/70 p-3">
              <p className="font-ui text-[11px] uppercase tracking-wide text-muted-foreground">Follower growth</p>
              <p className="mt-1 font-display text-xl text-foreground">
                {writerGrowthQuery.data?.follower_growth ?? 0}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={async () => {
                const link = `${window.location.origin}/browse?ref=${encodeURIComponent(`@${me?.username || ""}`)}`;
                await navigator.clipboard.writeText(link);
              }}
            >
              Invite readers (Copy link)
            </Button>
            <a
              href={buildFacebookShareIntent(`${window.location.origin}/browse?ref=${encodeURIComponent(`@${me?.username || ""}`)}`)}
              target="_blank"
              rel="noreferrer"
            >
              <Button>Share to Facebook</Button>
            </a>
          </div>
        </section>
      )}

      {/* Notifications */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card sm:p-7">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-semibold text-foreground">{t("dashboard.notifications", "Recent Notifications")}</h2>
          {notificationsQuery.data?.results?.length ? (
            <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 font-ui text-xs font-medium text-primary">
              {Math.min(notificationsQuery.data.results.length, 5)} new
            </span>
          ) : null}
        </div>

        {notificationsQuery.data?.results?.length ? (
          <div className="space-y-3">
            {notificationsQuery.data.results.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/70 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bell className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="mt-0.5 font-ui text-xs text-muted-foreground line-clamp-2">{item.message}</p>
                </div>
                <span className="shrink-0 font-ui text-[10px] text-muted-foreground">{timeAgo(item.created_at || "")}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/65 p-6 text-center">
            <BookOpenText className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="font-ui text-sm text-muted-foreground">{t("dashboard.noNotifications", "No notifications yet.")}</p>
          </div>
        )}

        {(writerApplicationQuery.isLoading || worksSummaryQuery.isLoading || notificationsQuery.isLoading) && (
          <p className="mt-3 font-ui text-xs text-muted-foreground">{t("dashboard.updating", "Updating…")}</p>
        )}
        {(writerApplicationQuery.isError || worksSummaryQuery.isError || notificationsQuery.isError) && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/35 bg-red-500/10 p-3 font-ui text-sm text-red-700">
            <ShieldAlert className="h-4 w-4" />
            {t("dashboard.partialError", "Some dashboard sections failed to load.")}
          </p>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
