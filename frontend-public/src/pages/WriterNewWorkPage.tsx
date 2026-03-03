import { useI18n } from "@/i18n";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BookOpen, Feather, FileText, PlusSquare, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createBook, createChapter, createPoem, createStory, fetchContent, fetchContentDetail } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type WorkType = "book" | "poem" | "story" | "chapter";

const WriterNewWorkPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [workType, setWorkType] = useState<WorkType>("book");
  const [bookIdForChapter, setBookIdForChapter] = useState<string>("");
  const [sourceType, setSourceType] = useState<"manual" | "upload">("manual");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const workTypeOptions = useMemo(() => [
    { value: "book", label: t("work.book"), description: "Long-form work with chapter outline", icon: BookOpen },
    { value: "poem", label: "Poem", description: "Poetry draft with rich formatting", icon: Feather },
    { value: "story", label: t("work.story"), description: "Short story writing workspace", icon: FileText },
    { value: "chapter", label: t("work.chapter"), description: "Create chapter under an existing book", icon: PlusSquare },
  ] as const, [t]);

  const booksQuery = useQuery({
    queryKey: ["writer", "books", "for-chapter"],
    queryFn: () => fetchContent("books", { mine: true, page: 1, requiresAuth: true }),
    enabled: workType === "chapter",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (workType === "book") {
        if (sourceType === "upload" && !uploadFile) {
          throw new Error(t("editor.uploadModeFile"));
        }

        const created = await createBook({
          title: t("editor.untitledBook"),
          description: "",
          foreword: sourceType === "manual" ? "<p></p>" : "",
          afterword: sourceType === "manual" ? "<p></p>" : "",
          numbering_style: "separator",
          source_type: sourceType,
          upload_file: sourceType === "upload" ? uploadFile : null,
          is_anonymous: isAnonymous,
        });
        return { route: `/writer/books/${created.id}/edit` };
      }

      if (workType === "poem") {
        if (sourceType === "upload" && !uploadFile) {
          throw new Error(t("editor.uploadModeFile"));
        }

        const created = await createPoem({
          title: t("editor.untitledPoem"),
          description: "",
          body: sourceType === "manual" ? `<p>${t("editor.startPoem")}</p>` : "",
          source_type: sourceType,
          upload_file: sourceType === "upload" ? uploadFile : null,
          is_anonymous: isAnonymous,
        });
        return { route: `/writer/poems/${created.id}/edit` };
      }

      if (workType === "story") {
        if (sourceType === "upload" && !uploadFile) {
          throw new Error(t("editor.uploadModeFile"));
        }

        const created = await createStory({
          title: t("editor.untitledStory"),
          description: "",
          body: sourceType === "manual" ? `<p>${t("editor.startStory")}</p>` : "",
          source_type: sourceType,
          upload_file: sourceType === "upload" ? uploadFile : null,
          is_anonymous: isAnonymous,
        });
        return { route: `/writer/stories/${created.id}/edit` };
      }

      if (!bookIdForChapter) {
        throw new Error(t("editor.chooseBookData"));
      }

      const selectedBookId = Number(bookIdForChapter);
      const book = await fetchContentDetail("books", selectedBookId, { requiresAuth: true });
      const nextOrder = (book.chapters?.length || 0) + 1;

      const chapter = (await createChapter({
        book: selectedBookId,
        title: `Chapter ${nextOrder}`,
        order: nextOrder,
        body: `<p>${t("editor.startChapter")}</p>`,
      })) as { id: number };

      return { route: `/writer/chapters/${chapter.id}/edit` };
    },
    onSuccess: ({ route }) => {
      toast({
        title: t("editor.draftCreated"),
        description: t("editor.editorOpening"),
      });
      navigate(route);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: t("editor.draftFailed"),
        description: error instanceof Error ? error.message : "სცადე ხელახლა.",
      });
    },
  });

  const selectedTypeMeta = useMemo(() => workTypeOptions.find((item) => item.value === workType), [workType]);
  const supportsUploadChoice = workType !== "chapter";

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-8 shadow-card">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-ui text-xs text-muted-foreground">{t("editor.writerWorkspace")}</span>
        </div>

        <h1 className="mt-4 font-display text-4xl font-semibold text-foreground">{t("work.newWork")}ს შექმნა</h1>
        <p className="mt-2 font-body text-base text-muted-foreground">
          Pick content type and source type. We will create your draft and open it immediately.
        </p>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label className="font-ui">{t("editor.contentType")}</Label>
            <Select
              value={workType}
              onValueChange={(value) => {
                const nextType = value as WorkType;
                setWorkType(nextType);
                if (nextType === "chapter") {
                  setSourceType("manual");
                  setUploadFile(null);
                }
              }}
            >
              <SelectTrigger className="font-ui">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {supportsUploadChoice ? (
            <div className="space-y-2">
              <Label className="font-ui">{t("work.sourceType")}</Label>
              <Select
                value={sourceType}
                onValueChange={(value) => {
                  setSourceType(value as "manual" | "upload");
                  setUploadFile(null);
                }}
              >
                <SelectTrigger className="font-ui">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">{t("work.manualWrite")}</SelectItem>
                  <SelectItem value="upload">{t("work.fileUpload")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {supportsUploadChoice ? (
            <div className="flex items-start justify-between rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="space-y-1 pr-4">
                <p className="font-ui text-sm font-medium text-foreground">{t("editor.publishAnon")}</p>
                <p className="font-ui text-xs text-muted-foreground">
                  საჯარო მკითხველები და რედაქტორები ნახავენ მხოლოდ t("editor.anonTag"). შენი ვინაობა მხოლოდ ადმინებს ექნებათ ხილული.
                </p>
              </div>
              <Switch id="anonymousToggleNewWork" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
            </div>
          ) : null}

          {supportsUploadChoice && sourceType === "upload" ? (
            <div className="space-y-2">
              <Label htmlFor="newWorkUpload" className="font-ui">{t("work.fileUpload")}</Label>
              <Input
                id="newWorkUpload"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
              <p className="font-ui text-xs text-muted-foreground">{t("editor.allowed")}: PDF, DOC, DOCX, TXT (მაქს. 20MB).</p>
            </div>
          ) : null}

          {selectedTypeMeta ? (
            <div className="rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="flex items-center gap-2">
                <selectedTypeMeta.icon className="h-4 w-4 text-primary" />
                <p className="font-display text-xl text-foreground">{selectedTypeMeta.label}</p>
              </div>
              <p className="mt-1 font-ui text-sm text-muted-foreground">{selectedTypeMeta.description}</p>
            </div>
          ) : null}

          {workType === "chapter" ? (
            <div className="space-y-2">
              <Label className="font-ui">{t("editor.chooseParentBook")}</Label>
              <Select value={bookIdForChapter} onValueChange={setBookIdForChapter}>
                <SelectTrigger className="font-ui">
                  <SelectValue placeholder="Choose a book" />
                </SelectTrigger>
                <SelectContent>
                  {booksQuery.data?.results?.map((book) => (
                    <SelectItem key={book.id} value={String(book.id)}>
                      {book.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!booksQuery.isLoading && !booksQuery.data?.results?.length ? (
                <p className="font-ui text-xs text-muted-foreground">
                  No books found. Create a book first.
                </p>
              ) : null}
            </div>
          ) : null}

          <Button
            className="w-full"
            onClick={() => createMutation.mutate()}
            disabled={
              createMutation.isPending ||
              (workType === "chapter" && !bookIdForChapter) ||
              (supportsUploadChoice && sourceType === "upload" && !uploadFile)
            }
          >
            {createMutation.isPending ? "Creating draft..." : "Create and Open Editor"}
          </Button>
        </div>
      </section>
    </div>
  );
};

export default WriterNewWorkPage;





