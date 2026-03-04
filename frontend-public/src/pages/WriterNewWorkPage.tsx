import { useI18n } from "@/i18n";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2, Feather, FileText, PlusSquare, Sparkles, Upload } from "lucide-react";

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

const workTypeCards = [
  {
    value: "book" as WorkType,
    icon: BookOpen,
    emoji: "📚",
    label: "Book",
    description: "Multi-chapter long-form writing. Best for novels and structured works.",
    color: "from-amber-500/10 to-orange-500/5",
    border: "border-amber-500/30",
  },
  {
    value: "poem" as WorkType,
    icon: Feather,
    emoji: "🖋️",
    label: "Poem",
    description: "Poetry with line-break preservation and centered layout.",
    color: "from-violet-500/10 to-purple-500/5",
    border: "border-violet-500/30",
  },
  {
    value: "story" as WorkType,
    icon: FileText,
    emoji: "📝",
    label: "Short Story",
    description: "Standalone narrative. Ideal for short fiction and essays.",
    color: "from-emerald-500/10 to-teal-500/5",
    border: "border-emerald-500/30",
  },
  {
    value: "chapter" as WorkType,
    icon: PlusSquare,
    emoji: "📖",
    label: "Chapter",
    description: "Add a chapter to an existing book in your library.",
    color: "from-sky-500/10 to-blue-500/5",
    border: "border-sky-500/30",
  },
] as const;

const WriterNewWorkPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [workType, setWorkType] = useState<WorkType>("book");
  const [bookIdForChapter, setBookIdForChapter] = useState<string>("");
  const [sourceType, setSourceType] = useState<"manual" | "upload">("manual");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const booksQuery = useQuery({
    queryKey: ["writer", "books", "for-chapter"],
    queryFn: () => fetchContent("books", { mine: true, page: 1, requiresAuth: true }),
    enabled: workType === "chapter",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (workType === "book") {
        if (sourceType === "upload" && !uploadFile) throw new Error(t("editor.uploadModeFile"));
        const created = await createBook({
          title: t("editor.untitledBook"),
          description: "",
          foreword: "",
          afterword: "",
          numbering_style: "separator",
          source_type: sourceType,
          upload_file: sourceType === "upload" ? uploadFile : null,
          is_anonymous: isAnonymous,
        });
        return { route: `/writer/books/${created.id}/edit` };
      }
      if (workType === "poem") {
        if (sourceType === "upload" && !uploadFile) throw new Error(t("editor.uploadModeFile"));
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
        if (sourceType === "upload" && !uploadFile) throw new Error(t("editor.uploadModeFile"));
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
      if (!bookIdForChapter) throw new Error(t("editor.chooseBookData"));
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
      toast({ title: t("editor.draftCreated"), description: t("editor.editorOpening") });
      navigate(route);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: t("editor.draftFailed"), description: error instanceof Error ? error.message : "Try again." });
    },
  });

  const supportsUploadChoice = workType !== "chapter";
  const canCreate = !createMutation.isPending &&
    !(workType === "chapter" && !bookIdForChapter) &&
    !(supportsUploadChoice && sourceType === "upload" && !uploadFile);

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      {/* Header */}
      <section className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-ui text-xs text-muted-foreground">{t("editor.writerWorkspace")}</span>
        </div>
        <h1 className="mt-4 font-display text-4xl font-semibold text-foreground">What will you create?</h1>
        <p className="mt-2 font-body text-base text-muted-foreground">
          Choose your content type and we'll open the editor immediately.
        </p>
      </section>

      {/* Content type cards */}
      <section>
        <p className="mb-3 font-ui text-sm font-medium text-muted-foreground">Step 1 — Choose type</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {workTypeCards.map((card) => {
            const Icon = card.icon;
            const selected = workType === card.value;
            return (
              <button
                key={card.value}
                type="button"
                onClick={() => {
                  setWorkType(card.value);
                  if (card.value === "chapter") { setSourceType("manual"); setUploadFile(null); }
                }}
                className={`relative flex items-start gap-4 rounded-xl border-2 bg-gradient-to-br p-4 text-left transition-all duration-200 ${selected
                    ? `${card.border} ${card.color} shadow-md`
                    : "border-border/60 bg-background/60 hover:border-primary/30 hover:bg-card/80"
                  }`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm ${selected ? "bg-card shadow-md" : "bg-muted/60"
                  }`}>
                  {card.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-base font-semibold text-foreground">{card.label}</p>
                    {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="mt-1 font-ui text-xs leading-relaxed text-muted-foreground">{card.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Source type + options */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card space-y-5">
        <p className="font-ui text-sm font-medium text-muted-foreground">Step 2 — Configure</p>

        {supportsUploadChoice && (
          <div className="space-y-2">
            <Label className="font-ui text-sm font-medium">{t("work.sourceType")}</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["manual", "upload"] as const).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => { setSourceType(src); setUploadFile(null); }}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${sourceType === src
                      ? "border-primary bg-primary/5"
                      : "border-border/60 bg-background/60 hover:border-primary/30"
                    }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${sourceType === src ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {src === "manual" ? <Feather className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                  </div>
                  <span className="font-ui text-sm font-medium text-foreground">
                    {src === "manual" ? t("work.manualWrite") : t("work.fileUpload")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {supportsUploadChoice && sourceType === "upload" && (
          <div className="space-y-2">
            <Label htmlFor="newWorkUpload" className="font-ui text-sm font-medium">Upload file</Label>
            <div className="rounded-xl border-2 border-dashed border-border/70 bg-background/60 p-5 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="font-ui text-sm text-muted-foreground">Drag & drop or click to browse</p>
              <p className="font-ui text-xs text-muted-foreground/70 mt-1">PDF, DOC, DOCX, TXT — max 20MB</p>
              <Input
                id="newWorkUpload"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="mt-3"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
              {uploadFile && (
                <p className="mt-2 font-ui text-xs text-primary font-medium">✓ {uploadFile.name}</p>
              )}
            </div>
          </div>
        )}

        {workType === "chapter" && (
          <div className="space-y-2">
            <Label className="font-ui text-sm font-medium">{t("editor.chooseParentBook")}</Label>
            <Select value={bookIdForChapter} onValueChange={setBookIdForChapter}>
              <SelectTrigger className="h-11 font-ui">
                <SelectValue placeholder="Choose a book…" />
              </SelectTrigger>
              <SelectContent>
                {booksQuery.data?.results?.map((book) => (
                  <SelectItem key={book.id} value={String(book.id)}>{book.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!booksQuery.isLoading && !booksQuery.data?.results?.length && (
              <p className="font-ui text-xs text-muted-foreground">No books found — create a book first.</p>
            )}
          </div>
        )}

        {supportsUploadChoice && (
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 p-4">
            <div className="pr-4">
              <p className="font-ui text-sm font-medium text-foreground">{t("editor.publishAnon")}</p>
              <p className="font-ui text-xs text-muted-foreground mt-0.5">Your name won't be visible to readers. Admins can still see it.</p>
            </div>
            <Switch id="anonymousToggleNewWork" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          </div>
        )}

        <Button
          className="w-full h-12 gap-2 font-ui text-base font-semibold"
          onClick={() => createMutation.mutate()}
          disabled={!canCreate}
        >
          {createMutation.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Creating draft…
            </span>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Create & Open Editor
            </>
          )}
        </Button>
      </section>
    </div>
  );
};

export default WriterNewWorkPage;
