import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BookOpenText, ClipboardCheck, Feather, ShieldAlert, UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/i18n";
import { fetchContent, fetchMyWriterApplications, fetchNotifications } from "@/lib/api";

const statusStyles: Record<string, string> = {
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700",
};

const DashboardPage = () => {
  const queryClient = useQueryClient();
  const { me } = useSession();
  const { t } = useI18n();

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

      return {
        books: books.count,
        chapters: chapters.count,
        poems: poems.count,
        stories: stories.count,
      };
    },
    enabled: Boolean(me),
  });

  const latestApplication = writerApplicationQuery.data?.results?.[0];

  useEffect(() => {
    if (latestApplication?.status === "approved" && me && !me.is_writer_approved) {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  }, [latestApplication?.status, me, queryClient]);

  const workCards = [
    { key: "books", label: t("dashboard.books", "Books"), value: worksSummaryQuery.data?.books ?? 0 },
    { key: "chapters", label: t("dashboard.chapters", "Chapters"), value: worksSummaryQuery.data?.chapters ?? 0 },
    { key: "poems", label: t("dashboard.poems", "Poems"), value: worksSummaryQuery.data?.poems ?? 0 },
    { key: "stories", label: t("dashboard.stories", "Stories"), value: worksSummaryQuery.data?.stories ?? 0 },
  ];

  const roleLabel = me ? t(`role.${me.effective_role}`, me.effective_role) : "";

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1">
              <UserCircle2 className="h-4 w-4 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">{t("dashboard.workspace", "Personal Workspace")}</span>
            </div>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-foreground">{t("dashboard.title", "Dashboard")}</h1>
            <p className="mt-2 font-body text-base text-muted-foreground">
              {t("dashboard.signedInAs", "Signed in as")} <span className="font-semibold text-foreground">{me?.username}</span> ({roleLabel}).
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {me?.is_writer_approved ? (
              <Link to="/writer/new">
                <Button>{t("dashboard.newWork", "New Work")}</Button>
              </Link>
            ) : (
              <Link to="/writer-application">
                <Button>{t("dashboard.writerApplication", "Writer Application")}</Button>
              </Link>
            )}
            <Link to="/my-works">
              <Button variant="outline">{t("nav.myWorks", "My Works")}</Button>
            </Link>
            <Link to="/settings">
              <Button variant="outline">{t("nav.settings", "Settings")}</Button>
            </Link>
          </div>
        </div>

        {!me?.is_email_verified ? (
          <p className="mt-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 font-ui text-sm text-amber-700">
            {t("dashboard.verifyEmail", "Verify your email before using protected features.")}
          </p>
        ) : null}

        {me?.forced_password_change ? (
          <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 font-ui text-sm text-red-700">
            {t("dashboard.forcePassword", "Password change is required before continuing.")}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {workCards.map((item) => (
          <div key={item.key} className="rounded-xl border border-border/70 bg-card/80 p-5 shadow-card">
            <p className="font-ui text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </section>

      {!me?.is_writer_approved ? (
        <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl font-semibold text-foreground">{t("dashboard.writerStatus", "Writer Application Status")}</h2>
          </div>
          {latestApplication ? (
            <div className="mt-4 rounded-xl border border-border/70 bg-background/70 p-4 font-ui text-sm">
              <p>
                {t("dashboard.status", "Status")}: {" "}
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[latestApplication.status] || "border-border bg-muted text-foreground"}`}
                >
                  {latestApplication.status}
                </span>
              </p>
              <p className="mt-2 text-muted-foreground">{t("dashboard.submitted", "Submitted")}: {new Date(latestApplication.created_at).toLocaleString()}</p>
              {latestApplication.review_comment ? (
                <p className="mt-3 rounded-lg border border-border/70 bg-card/80 p-3 text-foreground">
                  {t("dashboard.reviewerComment", "Reviewer comment")}: {latestApplication.review_comment}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-background/65 p-5 font-ui text-sm text-muted-foreground">
              {t("dashboard.noWriterApp", "No writer application yet. Submit one to unlock writer privileges after approval.")}
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold text-foreground">{t("dashboard.notifications", "Recent Notifications")}</h2>
        </div>

        {notificationsQuery.data?.results?.length ? (
          <div className="mt-4 space-y-3">
            {notificationsQuery.data.results.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                <p className="font-display text-lg text-foreground">{item.title}</p>
                <p className="mt-1 font-ui text-sm text-muted-foreground">{item.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-background/65 p-5 font-ui text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <BookOpenText className="h-4 w-4" />
              {t("dashboard.noNotifications", "No notifications yet.")}
            </div>
          </div>
        )}

        {(writerApplicationQuery.isLoading || worksSummaryQuery.isLoading || notificationsQuery.isLoading) ? (
          <p className="mt-4 font-ui text-xs text-muted-foreground">{t("dashboard.updating", "Updating dashboard...")}</p>
        ) : null}

        {writerApplicationQuery.isError || worksSummaryQuery.isError || notificationsQuery.isError ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/35 bg-red-500/10 p-3 font-ui text-sm text-red-700">
            <ShieldAlert className="h-4 w-4" />
            {t("dashboard.partialError", "Some dashboard sections failed to load.")}
          </p>
        ) : null}
      </section>

      {me?.is_writer_approved ? (
        <section className="rounded-2xl border border-border/70 bg-gradient-to-r from-primary/10 via-card/80 to-accent/10 p-6 shadow-card">
          <div className="flex items-center gap-2">
            <Feather className="h-5 w-5 text-primary" />
            <p className="font-display text-xl font-semibold text-foreground">{t("dashboard.writerMode", "Writer mode active")}</p>
          </div>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            {t("dashboard.writerModeDesc", "You are approved as writer. Start publishing books from your writer workspace.")}
          </p>
          <div className="mt-4">
            <Link to="/writer/new">
              <Button className="gap-2">{t("dashboard.newWork", "New Work")}</Button>
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default DashboardPage;
