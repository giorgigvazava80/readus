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
import { createBook, createChapter, createPoem, createStory, fetchContent, fetchContentDetail } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const workTypeOptions = [
  { value: "book", label: "Book", description: "Long-form work with chapter outline", icon: BookOpen },
  { value: "poem", label: "Poem", description: "Poetry draft with rich formatting", icon: Feather },
  { value: "story", label: "Story", description: "Short story writing workspace", icon: FileText },
  { value: "chapter", label: "Chapter", description: "Create chapter under an existing book", icon: PlusSquare },
] as const;

type WorkType = (typeof workTypeOptions)[number]["value"];

const WriterNewWorkPage = () => {
  const navigate = useNavigate();
  const [workType, setWorkType] = useState<WorkType>("book");
  const [bookIdForChapter, setBookIdForChapter] = useState<string>("");
  const [sourceType, setSourceType] = useState<"manual" | "upload">("manual");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const booksQuery = useQuery({
    queryKey: ["writer", "books", "for-chapter"],
    queryFn: () => fetchContent("books", { mine: true, page: 1, requiresAuth: true }),
    enabled: workType === "chapter",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (workType === "book") {
        if (sourceType === "upload" && !uploadFile) {
          throw new Error("Choose file for upload mode");
        }

        const created = await createBook({
          title: "Untitled Book",
          description: "",
          foreword: sourceType === "manual" ? "<p></p>" : "",
          afterword: sourceType === "manual" ? "<p></p>" : "",
          numbering_style: "separator",
          source_type: sourceType,
          upload_file: sourceType === "upload" ? uploadFile : null,
        });
        return { route: `/writer/books/${created.id}/edit` };
      }

      if (workType === "poem") {
        if (sourceType === "upload" && !uploadFile) {
          throw new Error("Choose file for upload mode");
        }

        const created = await createPoem({
          title: "Untitled Poem",
          description: "",
          body: sourceType === "manual" ? "<p>Start writing your poem...</p>" : "",
          source_type: sourceType,
          upload_file: sourceType === "upload" ? uploadFile : null,
        });
        return { route: `/writer/poems/${created.id}/edit` };
      }

      if (workType === "story") {
        if (sourceType === "upload" && !uploadFile) {
          throw new Error("Choose file for upload mode");
        }

        const created = await createStory({
          title: "Untitled Story",
          description: "",
          body: sourceType === "manual" ? "<p>Start writing your story...</p>" : "",
          source_type: sourceType,
          upload_file: sourceType === "upload" ? uploadFile : null,
        });
        return { route: `/writer/stories/${created.id}/edit` };
      }

      if (!bookIdForChapter) {
        throw new Error("Choose a book first");
      }

      const selectedBookId = Number(bookIdForChapter);
      const book = await fetchContentDetail("books", selectedBookId, { requiresAuth: true });
      const nextOrder = (book.chapters?.length || 0) + 1;

      const chapter = (await createChapter({
        book: selectedBookId,
        title: `Chapter ${nextOrder}`,
        order: nextOrder,
        body: "<p>Start writing your chapter...</p>",
      })) as { id: number };

      return { route: `/writer/chapters/${chapter.id}/edit` };
    },
    onSuccess: ({ route }) => {
      toast({
        title: "Draft created",
        description: "Opening editor...",
      });
      navigate(route);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Unable to create draft",
        description: error instanceof Error ? error.message : "Try again.",
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
          <span className="font-ui text-xs text-muted-foreground">Writer Workspace</span>
        </div>

        <h1 className="mt-4 font-display text-4xl font-semibold text-foreground">Create New Work</h1>
        <p className="mt-2 font-body text-base text-muted-foreground">
          Pick content type and source type. We will create your draft and open it immediately.
        </p>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label className="font-ui">Content type</Label>
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
              <Label className="font-ui">Source type</Label>
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
                  <SelectItem value="manual">Manual writing</SelectItem>
                  <SelectItem value="upload">Upload file</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {supportsUploadChoice && sourceType === "upload" ? (
            <div className="space-y-2">
              <Label htmlFor="newWorkUpload" className="font-ui">Upload file</Label>
              <Input
                id="newWorkUpload"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
              <p className="font-ui text-xs text-muted-foreground">Allowed: PDF, DOC, DOCX, TXT (max 20MB).</p>
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
              <Label className="font-ui">Select parent book</Label>
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
