import { useI18n } from "@/i18n";
﻿import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Feather, FileText, ImagePlus, Save, X, Trash } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { fetchContentDetail, resolveMediaUrl, updatePoem, updateStory, deleteContentItem } from "@/lib/api";
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
  is_anonymous: boolean;
  is_hidden: boolean;
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

function toDraft(data: {
  title?: string;
  description?: string;
  body?: string;
  source_type?: SourceType;
  is_anonymous?: boolean;
  is_hidden?: boolean;
}): TextWorkDraft {
  return {
    title: data.title || "",
    description: data.description || "",
    body: data.body || "",
    source_type: data.source_type || "manual",
    is_anonymous: Boolean(data.is_anonymous),
    is_hidden: Boolean(data.is_hidden),
  };
}

const WriterTextWorkEditorPage = ({ type }: WriterTextWorkEditorPageProps) => {
  const { t } = useI18n();
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
    title: t("editor.untitled"),
    description: "",
    body: "",
    source_type: "manual",
    is_anonymous: false,
    is_hidden: false,
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverRevision, setCoverRevision] = useState(0);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const saveMutation = useMutation({
    mutationFn: async (payload: TextWorkDraft) => {
      if (payload.source_type === "upload" && !uploadFile && !detailQuery.data?.upload_file) {
        throw new Error(t("editor.noUploadFile"));
      }

      return meta.update(contentId, {
        title: payload.title,
        description: payload.description,
        body: payload.body,
        source_type: payload.source_type,
        is_anonymous: payload.is_anonymous,
        is_hidden: payload.is_hidden,
        upload_file: payload.source_type === "upload" ? uploadFile : null,
        cover_image: coverImage,
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["writer", type, contentId], saved);
      queryClient.invalidateQueries({ queryKey: ["my-works"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "works-summary"] });
      setUploadFile(null);
      setCoverImage(null);
      setCoverPreview(null);
    },
  });

  const autosave = useAutosave<{ draft: TextWorkDraft; coverRevision: number }>({
    value: { draft, coverRevision },
    enabled: detailQuery.isSuccess,
    onSave: async ({ draft: payload }) => {
      await saveMutation.mutateAsync(payload);
    },
  });

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }
    const nextDraft = toDraft(detailQuery.data);
    if (!nextDraft.title) nextDraft.title = t("editor.untitled");
    setDraft(nextDraft);
    setUploadFile(null);
    setCoverImage(null);
    setCoverPreview(null);
    setCoverRevision(0);
    autosave.markSaved({ draft: nextDraft, coverRevision: 0 });
  }, [detailQuery.data, autosave.markSaved]);

  const statusClass = useMemo(() => {
    const status = detailQuery.data?.status;
    return status ? CONTENT_STATUS_STYLES[status] : "";
  }, [detailQuery.data?.status]);

  const currentCoverUrl = coverPreview || resolveMediaUrl(detailQuery.data?.cover_image) || null;

  if (!Number.isFinite(contentId)) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">ID არასწორია.</p>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("editor.editorLoading")}</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto space-y-3 px-6 py-10">
        <p className="font-ui text-sm text-red-700">{t("editor.workLoadFail")}</p>
        <Button variant="outline" onClick={() => navigate("/writer/new")}>{t("work.newWork")}ს შექმნა</Button>
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
                toast({ title: t("editor.saved") });
              } catch (error) {
                toast({
                  variant: "destructive",
                  title: t("editor.saveFailed"),
                  description: error instanceof Error ? error.message : t("editor.verifyFields"),
                });
              }
            }}
            disabled={autosave.isSaving}
          >
            <Save className="h-4 w-4" />{t("editor.saveNow")}</Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={async () => {
              const label = type === "stories" ? "story" : "poem";
              if (window.confirm(`Are you sure you want to delete this ${label}? This action cannot be undone.`)) {
                try {
                  await deleteContentItem(type, contentId);
                  toast({ title: t("work.deleted") });
                  navigate("/writer/new");
                } catch (error) {
                  toast({ variant: "destructive", title: t("work.deleteFailed") });
                }
              }
            }}
          >
            <Trash className="h-4 w-4" />
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
            უარყოფის reason: {detailQuery.data.rejection_reason}
          </p>
        ) : null}
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="space-y-2">
          <Label className="font-ui">{t("work.title")}</Label>
          <Input
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            className="font-ui"
          />
        </div>

        <div className="space-y-2">
          <Label className="font-ui">{t("work.sourceType")}</Label>
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
              <SelectItem value="manual">{t("work.manualWrite")}</SelectItem>
              <SelectItem value="upload">{t("work.fileUpload")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex-1 space-y-2 rounded-xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="textAnonymousToggle" className="font-ui text-sm">{t("editor.publishAnon")}</Label>
                <p className="font-ui text-[11px] text-muted-foreground">
                  Hidden from readers. Visible to admins.
                </p>
              </div>
              <Switch
                id="textAnonymousToggle"
                checked={draft.is_anonymous}
                onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_anonymous: checked }))}
              />
            </div>
          </div>

          <div className="flex-1 space-y-2 rounded-xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="textHiddenToggle" className="font-ui text-sm">{t("editor.hiddenPub")}</Label>
                <p className="font-ui text-[11px] text-muted-foreground">{t("editor.hiddenDesc")}</p>
              </div>
              <Switch
                id="textHiddenToggle"
                checked={draft.is_hidden}
                onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_hidden: checked }))}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card">
        <h2 className="mb-1 font-display text-base font-semibold text-foreground">{t("editor.coverImage")}</h2>
        <p className="mb-4 font-ui text-xs text-muted-foreground">
          არასავალდებულო. ჩანს ნაშრომის ბარათზე. JPG, PNG, WEBP ან GIF — მაქს. 5MB.
        </p>
        <div className="flex flex-wrap items-start gap-5">
          {currentCoverUrl ? (
            <div className="group relative flex-shrink-0">
              <img
                src={currentCoverUrl || ""}
                alt="Cover preview"
                className="h-36 w-28 rounded-xl border object-cover shadow-card"
              />
              <button
                onClick={() => {
                  setCoverImage(null);
                  setCoverPreview(null);
                  if (coverInputRef.current) coverInputRef.current.value = "";
                  setCoverRevision((prev) => prev + 1);
                }}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div
              className="flex h-36 w-28 flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              onClick={() => coverInputRef.current?.click()}
            >
              <ImagePlus className="h-6 w-6" />
              <span className="px-2 text-center font-ui text-xs">{t("editor.addCover")}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-1">
            <input
              ref={coverInputRef}
              id="coverImageInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setCoverImage(file);
                if (file) {
                  const url = URL.createObjectURL(file);
                  setCoverPreview(url);
                } else {
                  setCoverPreview(null);
                }
                setCoverRevision((prev) => prev + 1);
              }}
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium font-ui transition-colors hover:border-primary/40 hover:text-primary"
            >
              <ImagePlus className="h-4 w-4" />
              {currentCoverUrl ? "Change cover" : "Upload cover"}
            </button>
            {coverImage && (
              <p className="font-ui text-xs text-muted-foreground">{t("editor.selected")} {coverImage.name} — შეინახება შემდეგ შენახვაზე.</p>
            )}
            {!coverImage && detailQuery.data?.cover_image && (
              <p className="font-ui text-xs text-muted-foreground">{t("editor.coverSavedServer")}</p>
            )}
          </div>
        </div>
      </section>

      {draft.source_type === "upload" ? (
        <section className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card">
          <div>
            <Label htmlFor="textWorkUpload" className="font-ui">{t("work.fileUpload")}</Label>
            <Input
              id="textWorkUpload"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            />
            <p className="mt-2 font-ui text-xs text-muted-foreground">{t("editor.allowed")}: PDF, DOC, DOCX, TXT (მაქს. 20MB).</p>
          </div>

          {detailQuery.data.upload_file ? (
            <p className="font-ui text-sm text-muted-foreground">
              Current file:{" "}
              <a className="underline" href={detailQuery.data.upload_file} target="_blank" rel="noreferrer">{t("editor.openFile")}</a>
            </p>
          ) : null}

          {!detailQuery.data.upload_file && !uploadFile ? (
            <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 font-ui text-sm text-amber-800">{t("editor.uploadBeforeSave")}</p>
          ) : null}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="space-y-2">
            <Label className="font-ui">{t("work.desc")}</Label>
            <RichTextEditor
              value={draft.description}
              onChange={(description) => setDraft((prev) => ({ ...prev, description }))}
              minHeightClass="min-h-[180px]"
              placeholder={t("editor.shortDescView")}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-ui">{t("editor.textLabel")}</Label>
            <RichTextEditor
              value={draft.body}
              onChange={(body) => setDraft((prev) => ({ ...prev, body }))}
              minHeightClass="min-h-[420px]"
              placeholder={t("editor.writeFullText")}
            />
          </div>
        </section>
      )}
    </div>
  );
};

export default WriterTextWorkEditorPage;





