import { useI18n } from "@/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ListTree, ScrollText, Send } from "lucide-react";

import RichTextEditor from "@/components/editor/RichTextEditor";
import SaveStateBadge from "@/components/editor/SaveStateBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchContentDetail, submitChapterForReview, updateChapter } from "@/lib/api";
import { CONTENT_STATUS_STYLES } from "@/lib/content";
import { useAutosave } from "@/hooks/useAutosave";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";

interface ChapterDraft {
  title: string;
  order: number;
  body: string;
  book: number;
}

function toDraft(data: { title?: string; order?: number; body?: string; book?: number }): ChapterDraft {
  return {
    title: data.title || "",
    order: data.order || 1,
    body: data.body || "",
    book: data.book || 0,
  };
}

const WriterChapterEditorPage = () => {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const { id } = useParams();
  const chapterId = Number(id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const detailQuery = useQuery({
    queryKey: ["writer", "chapters", chapterId],
    queryFn: () => fetchContentDetail("chapters", chapterId, { requiresAuth: true }),
    enabled: Number.isFinite(chapterId),
  });

  const [draft, setDraft] = useState<ChapterDraft>({
    title: "",
    order: 1,
    body: "",
    book: 0,
  });
  const hasInitializedDraftRef = useRef(false);

  const saveMutation = useMutation({
    mutationFn: (payload: ChapterDraft) =>
      updateChapter(chapterId, {
        title: payload.title,
        order: payload.order,
        body: payload.body,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["writer", "chapters", chapterId], saved);
      queryClient.invalidateQueries({ queryKey: ["my-works"] });
      queryClient.invalidateQueries({ queryKey: ["writer", "book", draft.book] });
      queryClient.invalidateQueries({ queryKey: ["writer", "book-chapters", draft.book] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitChapterForReview(chapterId),
    onSuccess: (submitted) => {
      queryClient.setQueryData(["writer", "chapters", chapterId], submitted);
      queryClient.invalidateQueries({ queryKey: ["my-works"] });
      queryClient.invalidateQueries({ queryKey: ["writer", "book", draft.book] });
      queryClient.invalidateQueries({ queryKey: ["writer", "book-chapters", draft.book] });
      toast({ title: t("publish.sent", "Sent to redactor for approval.") });
    },
  });

  const autosave = useAutosave<ChapterDraft>({
    value: draft,
    enabled: detailQuery.isSuccess,
    onSave: async (payload) => {
      await saveMutation.mutateAsync(payload);
    },
  });

  useEffect(() => {
    hasInitializedDraftRef.current = false;
  }, [chapterId]);

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    const nextDraft = toDraft(detailQuery.data as { title?: string; order?: number; body?: string; book?: number });
    if (!hasInitializedDraftRef.current) {
      setDraft(nextDraft);
      autosave.markSaved(nextDraft);
      hasInitializedDraftRef.current = true;
      return;
    }

    if (autosave.hasUnsavedChanges || autosave.isSaving) {
      return;
    }

    setDraft(nextDraft);
    autosave.markSaved(nextDraft);
  }, [detailQuery.data, autosave.hasUnsavedChanges, autosave.isSaving, autosave.markSaved]);

  const statusClass = useMemo(() => {
    const status = detailQuery.data?.status;
    return status ? CONTENT_STATUS_STYLES[status] : "";
  }, [detailQuery.data?.status]);

  const canPublish =
    detailQuery.data?.status !== "approved" &&
    !detailQuery.data?.is_submitted_for_review;

  const handlePublish = async () => {
    const isConfirmed = await confirm({
      title: t("publish.button", "Publish"),
      description: t(
        "publish.confirmDescription",
        "This will be sent to a redactor for approval.",
      ),
      confirmText: t("publish.send", "Send"),
      cancelText: t("publish.cancel", "Decline"),
    });
    if (!isConfirmed) return;

    try {
      await autosave.saveNow();
      await submitMutation.mutateAsync();
    } catch (error) {
      toast({
        variant: "destructive",
        title: error instanceof Error ? error.message : t("publish.failed", "Failed to send to redactor."),
      });
    }
  };

  if (!Number.isFinite(chapterId)) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("editor.invalidId", "Invalid ID")}</p>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("editor.editorLoading", "Editor loading...")}</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto space-y-3 px-6 py-10">
        <p className="font-ui text-sm text-red-700">{t("editor.chapterFailed", "Failed to load chapter.")}</p>
        <Button variant="outline" onClick={() => navigate("/writer/new")}>{t("work.newWork")}</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl flex flex-col h-[calc(100dvh-64px)] sm:h-auto gap-3 px-3 py-3 sm:gap-6 sm:px-6 sm:py-10">
      <section data-editor-header-anchor="true" className="shrink-0 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1">
              <ScrollText className="h-3.5 w-3.5 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">{t("editor.chapterLabel", "Chapter Editor")}</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">{t("editor.editChapter", "Edit Chapter")}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {draft.book ? (
              <Link to={`/writer/books/${draft.book}/chapters`}>
                <Button variant="outline" size={isMobile ? "sm" : "default"} className="gap-2">
                  <ListTree className="h-4 w-4" />
                  {t("editor.backToBook", "Back to book")}
                </Button>
              </Link>
            ) : null}
            {canPublish ? (
              <Button
                size={isMobile ? "sm" : "default"}
                className="gap-2"
                onClick={handlePublish}
                disabled={autosave.isSaving || submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t("publish.button", "Publish")}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusClass}>{detailQuery.data.status}</Badge>
          {detailQuery.data.is_submitted_for_review && detailQuery.data.status === "draft" ? (
            <Badge
              variant="outline"
              className="border-sky-500/50 bg-sky-500/10 text-sky-700"
            >
              {t("myWorks.sentToRedactor", "Sent to redactor")}
            </Badge>
          ) : null}
          <SaveStateBadge
            isSaving={autosave.isSaving}
            hasUnsavedChanges={autosave.hasUnsavedChanges}
            lastSavedAt={autosave.lastSavedAt}
            lastError={autosave.lastError}
          />
        </div>

        {detailQuery.data.rejection_reason ? (
          <p className="mt-4 rounded-lg border border-red-500/35 bg-red-500/10 p-3 font-ui text-sm text-red-700">
            {t("editor.rejectionReason", "Rejection reason")}: {detailQuery.data.rejection_reason}
          </p>
        ) : null}
      </section>

      <section className="shrink-0 flex items-center gap-3">
        <div className="flex-[3] space-y-1.5">
          <Label className="font-ui text-xs sm:text-sm">{t("work.titleOpt", "Title (Optional)")}</Label>
          <Input
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            className="font-ui"
          />
        </div>

        <div className="flex-[1] space-y-1.5 min-w-[60px]">
          <Label className="font-ui text-xs sm:text-sm">{t("editor.order")}</Label>
          <Input
            type="number"
            min={1}
            value={draft.order}
            onChange={(event) => setDraft((prev) => ({ ...prev, order: Math.max(1, Number(event.target.value || 1)) }))}
            className="font-ui"
          />
        </div>
      </section>

      <section className="flex flex-col flex-1 min-h-0 space-y-1.5">
        <Label className="font-ui text-xs sm:text-sm shrink-0">{t("editor.chapterText")}</Label>
        <RichTextEditor
          value={draft.body}
          onChange={(body) => setDraft((prev) => ({ ...prev, body }))}
          className="flex-1 flex flex-col min-h-0"
          minHeightClass="flex-1 overflow-y-auto min-h-0"
          placeholder={t("editor.startChapter", "Start writing chapter...")}
        />
      </section>

    </div>
  );
};

export default WriterChapterEditorPage;
