import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Feather, FileText, Save } from "lucide-react";

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
import { fetchContentDetail, updatePoem, updateStory } from "@/lib/api";
import { CONTENT_STATUS_STYLES } from "@/lib/content";
import { useAutosave } from "@/hooks/useAutosave";
import { toast } from "@/hooks/use-toast";

interface WriterTextWorkEditorPageProps {
  type: "poems" | "stories";
}

type SourceType = "manual" | "upload";

interface TextWorkDraft {
  title: string;
  description: string;
  body: string;
  source_type: SourceType;
}

const writerMeta = {
  poems: {
    title: "Poem Editor",
    icon: Feather,
    update: updatePoem,
  },
  stories: {
    title: "Story Editor",
    icon: FileText,
    update: updateStory,
  },
};

function toDraft(data: { title?: string; description?: string; body?: string; source_type?: SourceType }): TextWorkDraft {
  return {
    title: data.title || "Untitled",
    description: data.description || "",
    body: data.body || "",
    source_type: data.source_type || "manual",
  };
}

const WriterTextWorkEditorPage = ({ type }: WriterTextWorkEditorPageProps) => {
  const { id } = useParams();
  const contentId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meta = writerMeta[type];

  const detailQuery = useQuery({
    queryKey: ["writer", type, contentId],
    queryFn: () => fetchContentDetail(type, contentId, { requiresAuth: true }),
    enabled: Number.isFinite(contentId),
  });

  const [draft, setDraft] = useState<TextWorkDraft>({
    title: "Untitled",
    description: "",
    body: "",
    source_type: "manual",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (payload: TextWorkDraft) => {
      if (payload.source_type === "upload" && !uploadFile && !detailQuery.data?.upload_file) {
        throw new Error("Choose upload file first.");
      }

      return meta.update(contentId, {
        title: payload.title,
        description: payload.description,
        body: payload.body,
        source_type: payload.source_type,
        upload_file: payload.source_type === "upload" ? uploadFile : null,
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["writer", type, contentId], saved);
      queryClient.invalidateQueries({ queryKey: ["my-works"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "works-summary"] });
      setUploadFile(null);
    },
  });

  const autosave = useAutosave<TextWorkDraft>({
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

  if (!Number.isFinite(contentId)) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">Invalid id.</p>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto space-y-3 px-6 py-10">
        <p className="font-ui text-sm text-red-700">Could not load this work.</p>
        <Button variant="outline" onClick={() => navigate("/writer/new")}>Create New Work</Button>
      </div>
    );
  }

  const Icon = meta.icon;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1">
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">{meta.title}</span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">{meta.title}</h1>
          </div>

          <Button
            className="gap-2"
            onClick={async () => {
              try {
                await autosave.saveNow();
                toast({ title: "Saved" });
              } catch (error) {
                toast({
                  variant: "destructive",
                  title: "Save failed",
                  description: error instanceof Error ? error.message : "Please check required fields.",
                });
              }
            }}
            disabled={autosave.isSaving}
          >
            <Save className="h-4 w-4" />
            Save Now
          </Button>
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
            Rejection reason: {detailQuery.data.rejection_reason}
          </p>
        ) : null}
      </section>

      <section className="grid gap-5 md:grid-cols-2">
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
      </section>

      {draft.source_type === "upload" ? (
        <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card space-y-3">
          <div>
            <Label htmlFor="textWorkUpload" className="font-ui">Upload file</Label>
            <Input
              id="textWorkUpload"
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
          <div className="space-y-2">
            <Label className="font-ui">Description</Label>
            <RichTextEditor
              value={draft.description}
              onChange={(description) => setDraft((prev) => ({ ...prev, description }))}
              minHeightClass="min-h-[180px]"
              placeholder="Short description for readers..."
            />
          </div>

          <div className="space-y-2">
            <Label className="font-ui">Body</Label>
            <RichTextEditor
              value={draft.body}
              onChange={(body) => setDraft((prev) => ({ ...prev, body }))}
              minHeightClass="min-h-[420px]"
              placeholder="Write your full text here..."
            />
          </div>
        </section>
      )}
    </div>
  );
};

export default WriterTextWorkEditorPage;
