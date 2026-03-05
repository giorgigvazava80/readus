import { useI18n } from "@/i18n";
import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, FileText, Upload } from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/hooks/useSession";
import { cancelWriterApplication, fetchMyWriterApplications, submitWriterApplication } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const statusStyles: Record<string, string> = {
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  canceled: "border-slate-500/30 bg-slate-500/10 text-slate-700",
};

const WriterApplicationPage = () => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { me } = useSession();

  const [sampleText, setSampleText] = useState("");
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const applicationsQuery = useQuery({
    queryKey: ["writer-applications", "mine", 1],
    queryFn: () => fetchMyWriterApplications(1),
  });

  const latestApplication = applicationsQuery.data?.results?.[0];
  const pendingApplication = applicationsQuery.data?.results?.find((app) => app.status === "pending") || null;
  const hasPendingApplication = Boolean(pendingApplication);

  useEffect(() => {
    if (latestApplication?.status === "approved" && me && !me.is_writer_approved) {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  }, [latestApplication?.status, me, queryClient]);

  if (me?.is_writer_approved) {
    return <Navigate to="/writer/new" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!sampleText.trim() && !sampleFile) {
      toast.error(t("work.provideTextOrFile"));
      return;
    }

    setLoading(true);
    try {
      await submitWriterApplication({ sampleText: sampleText.trim(), sampleFile });
      setSampleText("");
      setSampleFile(null);
      await queryClient.invalidateQueries({ queryKey: ["writer-applications", "mine"] });
      toast.success(t("writer.appSubmitted"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit application.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPending = async () => {
    if (!pendingApplication) return;
    const confirmed = window.confirm(
      t("writer.cancelPendingConfirm", "Cancel your pending writer application?"),
    );
    if (!confirmed) return;

    setCanceling(true);
    try {
      await cancelWriterApplication(pendingApplication.id);
      await queryClient.invalidateQueries({ queryKey: ["writer-applications", "mine"] });
      toast.success(t("writer.appCanceled", "Writer application canceled."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel application.";
      toast.error(message);
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <h1 className="font-display text-4xl font-semibold text-foreground">{t("writer.appTitle", "Writer Application")}</h1>
        <p className="mt-2 font-body text-base text-muted-foreground">{t("writer.appDesc")}</p>
        {hasPendingApplication ? (
          <div className="mt-7 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="font-ui text-sm text-amber-800">
              {t("writer.pendingLocked", "Your previous application is under review. You can submit a new one after it is approved, rejected, or canceled.")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelPending}
              disabled={canceling}
              className="mt-3"
            >
              {canceling
                ? t("writer.canceling", "Canceling...")
                : t("writer.cancelPending", "Cancel Pending Application")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="sampleText" className="font-ui">{t("writer.sampleText")}</Label>
              <Textarea
                id="sampleText"
                rows={10}
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                placeholder={t("writer.pasteSample")}
                className="font-body leading-relaxed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sampleFile" className="font-ui">{t("writer.sampleFileLabel", "Sample file")}</Label>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/65 px-6 py-8 text-center transition-colors hover:border-primary/60 hover:bg-card/60">
                <Upload className="h-6 w-6 text-primary" />
                <span className="font-ui text-sm text-muted-foreground">
                  {sampleFile ? sampleFile.name : t("writer.uploadHint", "Upload .pdf, .doc, .docx or .txt")}
                </span>
                <Input
                  id="sampleFile"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => setSampleFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? t("writer.submitting", "Submitting...") : t("writer.submitApp", "Submit Application")}
            </Button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex items-center gap-2">
          <Clock3 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold text-foreground">{t("writer.history")}</h2>
        </div>

        {applicationsQuery.data?.results?.length ? (
          <div className="mt-5 space-y-3">
            {applicationsQuery.data.results.map((app) => (
              <div key={app.id} className="rounded-xl border border-border/70 bg-background/70 p-4 font-ui text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{t("writer.applicationNum", "Application #{id}").replace("{id}", String(app.id))}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[app.status] || "border-border bg-muted text-foreground"}`}
                  >
                    {t(`status.${app.status}`, app.status)}
                  </span>
                </p>
                <p className="mt-2 text-muted-foreground">{t("admin.createdTime")}: {new Date(app.created_at).toLocaleString()}</p>
                {app.reviewed_at ? <p className="text-muted-foreground">{t("writer.reviewedAt", "Reviewed")}: {new Date(app.reviewed_at).toLocaleString()}</p> : null}
                {app.review_comment ? (
                  <p className="mt-3 rounded-lg border border-border/70 bg-card/75 p-3 text-foreground">
                    {t("writer.reviewComment", "Comment")}: {app.review_comment}
                  </p>
                ) : null}
                {app.sample_file ? (
                  <a
                    className="mt-3 inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    href={app.sample_file}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText className="h-4 w-4" />{t("writer.openSampleFile")}</a>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-background/65 p-5 font-ui text-sm text-muted-foreground">{t("writer.noApps")}</div>
        )}
      </section>
    </div>
  );
};

export default WriterApplicationPage;




