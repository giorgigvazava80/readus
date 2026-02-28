import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchContentDetail, createChapter, deleteChapter, reorderChapters } from "@/lib/api";
import type { ChapterDetail } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

const WriterBookChaptersPage = () => {
  const { id } = useParams();
  const bookId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ["writer", "book", bookId],
    queryFn: () => fetchContentDetail("books", bookId, { requiresAuth: true }),
    enabled: Number.isFinite(bookId),
  });

  const [chapterList, setChapterList] = useState<ChapterDetail[]>([]);

  useEffect(() => {
    const chapters = (detailQuery.data?.chapters || []).slice().sort((a, b) => a.order - b.order);
    setChapterList(chapters);
  }, [detailQuery.data?.chapters]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const nextOrder = chapterList.length + 1;
      return createChapter({
        book: bookId,
        title: `Chapter ${nextOrder}`,
        order: nextOrder,
        body: "<p>Start writing your chapter...</p>",
      });
    },
    onSuccess: (chapter) => {
      toast({ title: "Chapter added" });
      queryClient.invalidateQueries({ queryKey: ["writer", "book", bookId] });
      const createdId = (chapter as { id: number }).id;
      navigate(`/writer/chapters/${createdId}/edit`);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not add chapter",
        description: error instanceof Error ? error.message : "Try again.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (chapterId: number) => deleteChapter(chapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["writer", "book", bookId] });
      toast({ title: "Chapter deleted" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (chapterIdsInOrder: number[]) => reorderChapters(chapterIdsInOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["writer", "book", bookId] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Could not reorder chapters" });
      queryClient.invalidateQueries({ queryKey: ["writer", "book", bookId] });
    },
  });

  const canReorder = useMemo(() => chapterList.length > 1 && !reorderMutation.isPending, [chapterList.length, reorderMutation.isPending]);

  const moveChapter = (chapterId: number, direction: "up" | "down") => {
    const index = chapterList.findIndex((item) => item.id === chapterId);
    if (index < 0) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapterList.length) {
      return;
    }

    const next = chapterList.slice();
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);

    const normalized = next.map((item, orderIndex) => ({ ...item, order: orderIndex + 1 }));
    setChapterList(normalized);
    reorderMutation.mutate(normalized.map((item) => item.id));
  };

  if (!Number.isFinite(bookId)) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">Invalid book id.</p>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">Loading chapters...</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto space-y-3 px-6 py-10">
        <p className="font-ui text-sm text-red-700">Could not load book chapters.</p>
        <Button variant="outline" onClick={() => navigate("/writer/new")}>Create New Work</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold text-foreground">Chapters: {detailQuery.data.title}</h1>
            <p className="mt-1 font-ui text-sm text-muted-foreground">
              Build your chapter outline. Reordering updates chapter numbers automatically.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/writer/books/${bookId}/edit`}>
              <Button variant="outline">Back to Book</Button>
            </Link>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Chapter
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {chapterList.length ? (
          chapterList.map((chapter, index) => (
            <div key={chapter.id} className="rounded-xl border border-border/70 bg-card/75 p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-ui text-xs uppercase tracking-wide text-muted-foreground">Order {chapter.order}</p>
                  <p className="font-display text-xl text-foreground">
                    {chapter.title || `Chapter ${chapter.auto_label || chapter.order}`}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!canReorder || index === 0}
                    onClick={() => moveChapter(chapter.id, "up")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!canReorder || index === chapterList.length - 1}
                    onClick={() => moveChapter(chapter.id, "down")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Link to={`/writer/chapters/${chapter.id}/edit`}>
                    <Button>Edit</Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => deleteMutation.mutate(chapter.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/65 p-6 font-ui text-sm text-muted-foreground">
            No chapters yet. Add your first chapter.
          </div>
        )}
      </section>
    </div>
  );
};

export default WriterBookChaptersPage;
