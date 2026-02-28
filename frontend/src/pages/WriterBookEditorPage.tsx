import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpenText, ListTree, Save } from "lucide-react";

import RichTextEditor from "@/components/editor/RichTextEditor";
import SaveStateBadge from "@/components/editor/SaveStateBadge";
import { Badge } from "@/components/ui/badge";
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
import { fetchContentDetail, updateBook } from "@/lib/api";
import { CONTENT_STATUS_STYLES } from "@/lib/content";
import { useAutosave } from "@/hooks/useAutosave";
import { toast } from "@/hooks/use-toast";

type NumberingStyle = "arabic" | "roman" | "separator";
type SourceType = "manual" | "upload";

interface BookDraft {
  title: string;
  description: string;
  foreword: string;
  afterword: string;
  numbering_style: NumberingStyle;
  source_type: SourceType;
}

function toDraft(data: {
  title?: string;
  description?: string;
  foreword?: string;
  afterword?: string;
  numbering_style?: NumberingStyle;
  source_type?: SourceType;
}): BookDraft {
  return {
    title: data.title || "Untitled Book",
    description: data.description || "",
    foreword: data.foreword || "",
    afterword: data.afterword || "",
    numbering_style: data.numbering_style || "separator",
    source_type: data.source_type || "manual",
  };
}

const WriterBookEditorPage = () => {
  const { id } = useParams();
  const bookId = Number(id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const detailQuery = useQuery({
    queryKey: ["writer", "book", bookId],
    queryFn: () => fetchContentDetail("books", bookId, { requiresAuth: true }),
    enabled: Number.isFinite(bookId),
  });

  const [draft, setDraft] = useState<BookDraft>({
    title: "Untitled Book",
    description: "",
    foreword: "",
    afterword: "",
    numbering_style: "separator",
    source_type: "manual",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (payload: BookDraft) => {
      if (payload.source_type === "upload" && !uploadFile && !detailQuery.data?.upload_file) {
        throw new Error("Choose upload file first.");
      }

      return updateBook(bookId, {
        title: payload.title,
        description: payload.description,
        foreword: payload.foreword,
        afterword: payload.afterword,
        numbering_style: payload.numbering_style,
        source_type: payload.source_type,
        upload_file: payload.source_type === "upload" ? uploadFile : null,
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["writer", "book", bookId], saved);
      queryClient.invalidateQueries({ queryKey: ["my-works"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "works-summary"] });
      setUploadFile(null);
    },
  });

  const autosave = useAutosave<BookDraft>({
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

    const nextDraft = toDraft(detailQuery.data);
    setDraft(nextDraft);
    setUploadFile(null);
    autosave.markSaved(nextDraft);
  }, [detailQuery.data, autosave.markSaved]);

  const statusClass = useMemo(() => {
    const status = detailQuery.data?.status;
    return status ? CONTENT_STATUS_STYLES[status] : "";
  }, [detailQuery.data?.status]);

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
        <p className="font-ui text-sm text-muted-foreground">Loading book editor...</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto px-6 py-10 space-y-3">
        <p className="font-ui text-sm text-red-700">Could not load this book.</p>
        <Button variant="outline" onClick={() => navigate("/writer/new")}>Create New Work</Button>
      </div>
    );
  }

  const status = detailQuery.data.status;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1">
              <BookOpenText className="h-3.5 w-3.5 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">Book Editor</span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">Edit Book</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/writer/books/${bookId}/chapters`}>
              <Button variant="outline" className="gap-2">
                <ListTree className="h-4 w-4" />
                Chapters
              </Button>
            </Link>
            <Button
              className="gap-2"
              onClick={async () => {
                try {
                  await autosave.saveNow();
                  toast({ title: "Book saved" });
                } catch (error) {
                  toast({
                    variant: "destructive",
                    title: "Save failed",
                    description: error instanceof Error ? error.message : "Please fix validation issues and try again.",
                  });
                }
              }}
              disabled={autosave.isSaving}
            >
              <Save className="h-4 w-4" />
              Save Now
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusClass}>{status}</Badge>
          <SaveStateBadge
            isSaving={autosave.isSaving}
            hasUnsavedChanges={autosave.hasUnsavedChanges}
            lastSavedAt={autosave.lastSavedAt}
            lastError={autosave.lastError}
          />
        </div>

        {detailQuery.data.rejection_reason ? (
          <p className="mt-4 rounded-lg border border-red-500/35 bg-red-500/10 p-3 font-ui text-sm text-red-700">
            Rejection reason: {detailQuery.data.rejection_reason}
          </p>
        ) : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-2">
          <Label className="font-ui">Title</Label>
          <Input
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            className="font-ui"
          />
        </div>

        <div className="space-y-2">
          <Label className="font-ui">Source type</Label>
          <Select
            value={draft.source_type}
            onValueChange={(value) => {
              setDraft((prev) => ({ ...prev, source_type: value as SourceType }));
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

        <div className="space-y-2">
          <Label className="font-ui">Chapter numbering</Label>
          <Select
            value={draft.numbering_style}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, numbering_style: value as NumberingStyle }))}
          >
            <SelectTrigger className="font-ui">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="separator">Separator (***)</SelectItem>
              <SelectItem value="arabic">Arabic (1,2,3)</SelectItem>
              <SelectItem value="roman">Roman (I,II,III)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {draft.source_type === "upload" ? (
        <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card space-y-3">
          <div>
            <Label htmlFor="bookUpload" className="font-ui">Upload book file</Label>
            <Input
              id="bookUpload"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            />
            <p className="mt-2 font-ui text-xs text-muted-foreground">Allowed: PDF, DOC, DOCX, TXT (max 20MB).</p>
          </div>

          {detailQuery.data.upload_file ? (
            <p className="font-ui text-sm text-muted-foreground">
              Current file: <a className="underline" href={detailQuery.data.upload_file} target="_blank" rel="noreferrer">Open file</a>
            </p>
          ) : null}

          {!detailQuery.data.upload_file && !uploadFile ? (
            <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 font-ui text-sm text-amber-800">
              Choose a file before saving in upload mode.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="space-y-4">
          <div>
            <Label className="font-ui">Description</Label>
            <RichTextEditor
              value={draft.description}
              onChange={(description) => setDraft((prev) => ({ ...prev, description }))}
              minHeightClass="min-h-[200px]"
              placeholder="Book description..."
            />
          </div>

          <div>
            <Label className="font-ui">Foreword</Label>
            <RichTextEditor
              value={draft.foreword}
              onChange={(foreword) => setDraft((prev) => ({ ...prev, foreword }))}
              minHeightClass="min-h-[260px]"
              placeholder="Foreword text..."
            />
          </div>

          <div>
            <Label className="font-ui">Afterword</Label>
            <RichTextEditor
              value={draft.afterword}
              onChange={(afterword) => setDraft((prev) => ({ ...prev, afterword }))}
              minHeightClass="min-h-[240px]"
              placeholder="Afterword text..."
            />
          </div>
        </section>
      )}
    </div>
  );
};

export default WriterBookEditorPage;
