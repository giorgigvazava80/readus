import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ListTree, Save, ScrollText } from "lucide-react";

import RichTextEditor from "@/components/editor/RichTextEditor";
import SaveStateBadge from "@/components/editor/SaveStateBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchContentDetail, updateChapter } from "@/lib/api";
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

  const autosave = useAutosave<ChapterDraft>({
    value: draft,
    enabled: detailQuery.isSuccess,
    onSave: async (payload) => {
      await saveMutation.mutateAsync(payload);
    },
  });

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    const nextDraft = toDraft(detailQuery.data as { title?: string; order?: number; body?: string; book?: number });
    setDraft(nextDraft);
    autosave.markSaved(nextDraft);
  }, [detailQuery.data, autosave.markSaved]);

  const statusClass = useMemo(() => {
    const status = detailQuery.data?.status;
    return status ? CONTENT_STATUS_STYLES[status] : "";
  }, [detailQuery.data?.status]);

  if (!Number.isFinite(chapterId)) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">თავის ID არასწორია.</p>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">თავის რედაქტორი იტვირთება...</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto space-y-3 px-6 py-10">
        <p className="font-ui text-sm text-red-700">თავის ჩატვირთვა ვერ მოხერხდა.</p>
        <Button variant="outline" onClick={() => navigate("/writer/new")}>ახალი ნაშრომის შექმნა</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-5 px-3 py-5 sm:space-y-6 sm:px-6 sm:py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1">
              <ScrollText className="h-3.5 w-3.5 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">თავის რედაქტორი</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">თავის რედაქტირება</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {draft.book ? (
              <Link to={`/writer/books/${draft.book}/chapters`}>
                <Button variant="outline" size={isMobile ? "sm" : "default"} className="gap-2">
                  <ListTree className="h-4 w-4" />
                  Back to თავები
                </Button>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusClass}>{detailQuery.data.status}</Badge>
          <SaveStateBadge
            isSaving={autosave.isSaving}
            hasUnsavedChanges={autosave.hasUnsavedChanges}
            lastSavedAt={autosave.lastSavedAt}
            lastError={autosave.lastError}
          />
        </div>

        {detailQuery.data.rejection_reason ? (
          <p className="mt-4 rounded-lg border border-red-500/35 bg-red-500/10 p-3 font-ui text-sm text-red-700">
            უარყოფის reason: {detailQuery.data.rejection_reason}
          </p>
        ) : null}
      </section>

      <section className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label className="font-ui">სათაური (არასავალდებულო)</Label>
          <Input
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            className="font-ui"
          />
        </div>

        <div className="space-y-2">
          <Label className="font-ui">რიგი</Label>
          <Input
            type="number"
            min={1}
            value={draft.order}
            onChange={(event) => setDraft((prev) => ({ ...prev, order: Math.max(1, Number(event.target.value || 1)) }))}
            className="font-ui"
          />
        </div>
      </section>

      <section className="space-y-2">
        <Label className="font-ui">თავის ტექსტი</Label>
        <RichTextEditor
          value={draft.body}
          onChange={(body) => setDraft((prev) => ({ ...prev, body }))}
          minHeightClass="min-h-[200px] sm:min-h-[420px]"
          placeholder="Write chapter text..."
        />
      </section>

      <div className="flex justify-end">
        <Button
          size={isMobile ? "sm" : "default"}
          className="w-full gap-2 sm:w-auto"
          onClick={async () => {
            try {
              await autosave.saveNow();
              toast({ title: "თავი შენახულია" });
            } catch {
              toast({ variant: "destructive", title: "შენახვა ვერ მოხერხდა" });
            }
          }}
          disabled={autosave.isSaving}
        >
          <Save className="h-4 w-4" />
          შენახვა ახლავე
        </Button>
      </div>
    </div>
  );
};

export default WriterChapterEditorPage;





