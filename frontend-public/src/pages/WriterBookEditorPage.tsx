import { useI18n } from "@/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpenText, ImagePlus, ListTree, Save, X, Plus, Trash } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";

import { fetchContentDetail, resolveMediaUrl, updateBook, createChapter, updateChapter, deleteChapter, deleteContentItem } from "@/lib/api";
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
  is_anonymous: boolean;
  is_hidden: boolean;
}

const hasTextContent = (html?: string | null) => {
  if (!html) return false;
  const stripped = html.replace(/<[^>]+>/g, "").trim();
  return stripped.length > 0;
};

function toDraft(data: {
  title?: string;
  description?: string;
  foreword?: string;
  afterword?: string;
  numbering_style?: NumberingStyle;
  source_type?: SourceType;
  is_anonymous?: boolean;
  is_hidden?: boolean;
}, defaultTitle: string): BookDraft {
  return {
    title: data.title || defaultTitle,
    description: data.description || "",
    foreword: data.foreword || "",
    afterword: data.afterword || "",
    numbering_style: data.numbering_style || "separator",
    source_type: data.source_type || "manual",
    is_anonymous: Boolean(data.is_anonymous),
    is_hidden: Boolean(data.is_hidden),
  };
}

// ──────────────────────────────────────────────────────────
// Inline თავის რედაქტორი Component
// ──────────────────────────────────────────────────────────
function ChapterEditorInline({ chapterId, bookId, onDelete }: { chapterId: number, bookId: number, onDelete: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ["writer", "chapters", chapterId],
    queryFn: () => fetchContentDetail("chapters", chapterId, { requiresAuth: true }),
    enabled: Number.isFinite(chapterId),
  });

  const [draft, setDraft] = useState({ title: "", order: 1, body: "" });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof draft) => updateChapter(chapterId, payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(["writer", "chapters", chapterId], saved);
      queryClient.invalidateQueries({ queryKey: ["writer", "book", bookId] });
      queryClient.invalidateQueries({ queryKey: ["my-works"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteChapter(chapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["writer", "book", bookId] });
      toast({ title: t("editor.chapterDeleted") });
      onDelete();
    }
  });

  const autosave = useAutosave({
    value: draft,
    enabled: detailQuery.isSuccess,
    onSave: async (payload) => {
      await saveMutation.mutateAsync(payload);
    },
  });

  const { markSaved: chapterმონიშვნაSaved } = autosave;
  useEffect(() => {
    if (detailQuery.data) {
      const nextDraft = {
        title: detailQuery.data.title || "",
        order: detailQuery.data.order || 1,
        body: detailQuery.data.body || "",
      };
      setDraft(nextDraft);
      chapterმონიშვნაSaved(nextDraft);
    }
  }, [detailQuery.data, chapterმონიშვნაSaved]);

  if (detailQuery.isLoading) {
    return <p className="font-ui text-sm text-muted-foreground p-6">{t("work.chapter")} იტვირთება...</p>;
  }
  if (!detailQuery.data) {
    return <p className="font-ui text-sm text-red-700 p-6">{t("work.chapter")}ს ჩატვირთვა ვერ მოხერხდა.</p>;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-semibold text-foreground">{t("work.chapter")}ს რედაქტირება</h2>
          <Badge variant="outline" className={CONTENT_STATUS_STYLES[detailQuery.data.status] || ""}>{detailQuery.data.status}</Badge>
          <SaveStateBadge
            isSaving={autosave.isSaving}
            hasUnsavedChanges={autosave.hasUnsavedChanges}
            lastSavedAt={autosave.lastSavedAt}
            lastError={autosave.lastError}
          />
        </div>
      </div>

      {detailQuery.data.rejection_reason && (
        <p className="rounded-lg border border-red-500/35 bg-red-500/10 p-3 font-ui text-sm text-red-700">
          უარყოფის reason: {detailQuery.data.rejection_reason}
        </p>
      )}

      <section className="shrink-0 flex items-center gap-3">
        <div className="flex-[3] space-y-1.5">
          <Label className="font-ui text-xs sm:text-sm">{t("work.title")} (არასავალდებულო)</Label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft(p => ({ ...p, title: e.target.value }))}
            className="font-ui"
          />
        </div>
        <div className="flex-[1] space-y-1.5 min-w-[60px]">
          <Label className="font-ui text-xs sm:text-sm">{t("editor.order")}</Label>
          <Input
            type="number"
            min={1}
            value={draft.order}
            onChange={(e) => setDraft(p => ({ ...p, order: Math.max(1, Number(e.target.value || 1)) }))}
            className="font-ui"
          />
        </div>
      </section>
      <section className="flex flex-col flex-1 min-h-0 space-y-1.5">
        <Label className="font-ui text-xs sm:text-sm shrink-0">{t("work.chapter")}ს ტექსტი</Label>
        <RichTextEditor
          value={draft.body}
          onChange={(body) => setDraft(p => ({ ...p, body }))}
          className="flex-1 flex flex-col min-h-0"
          minHeightClass="flex-1 overflow-y-auto min-h-0 min-h-[300px] sm:min-h-[420px]"
          placeholder="Write chapter text..."
        />
      </section>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="destructive" size="sm" onClick={() => {
          if (window.confirm("Are you sure you want to delete this chapter?")) {
            deleteMutation.mutate();
          }
        }} className="gap-2 h-9" disabled={deleteMutation.isPending}>
          <Trash className="h-3.5 w-3.5" /> {deleteMutation.isPending ? t("editor.deleting") : t("editor.delete")}
        </Button>
        <Button
          className="gap-2 h-9"
          size="sm"
          onClick={async () => {
            try {
              await autosave.saveNow();
              toast({ title: t("editor.chapterSaved") });
            } catch (error) {
              toast({ variant: "destructive", title: t("editor.saveFailed") });
            }
          }}
          disabled={autosave.isSaving}
        >
          <Save className="h-4 w-4" /> Save
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main Editor Page
// ──────────────────────────────────────────────────────────
const WriterBookEditorPage = () => {
  const { t } = useI18n();
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
    title: t("editor.untitledBook"),
    description: "",
    foreword: "",
    afterword: "",
    numbering_style: "separator",
    source_type: "manual",
    is_anonymous: false,
    is_hidden: false,
  });

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverRevision, setCoverRevision] = useState(0);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<"settings" | "foreword" | "afterword" | number>("settings");
  const [showAddNav, setShowAddNav] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (payload: BookDraft) => {
      if (payload.source_type === "upload" && !uploadFile && !detailQuery.data?.upload_file) {
        throw new Error(t("editor.noUploadFile"));
      }

      return updateBook(bookId, {
        title: payload.title,
        description: payload.description,
        foreword: payload.foreword,
        afterword: payload.afterword,
        numbering_style: payload.numbering_style,
        source_type: payload.source_type,
        is_anonymous: payload.is_anonymous,
        is_hidden: payload.is_hidden,
        upload_file: payload.source_type === "upload" ? uploadFile : null,
        cover_image: coverImage,
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["writer", "book", bookId], saved);
      queryClient.invalidateQueries({ queryKey: ["my-works"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "works-summary"] });
      setUploadFile(null);
      setCoverImage(null);
      setCoverPreview(null);
    },
  });

  const autosave = useAutosave<{ draft: BookDraft; coverRevision: number }>({
    value: { draft, coverRevision },
    enabled: detailQuery.isSuccess,
    onSave: async ({ draft: payload }) => {
      await saveMutation.mutateAsync(payload);
    },
  });

  const { markSaved: bookმონიშვნაSaved } = autosave;
  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    const nextDraft = toDraft(detailQuery.data, t("editor.untitledBook"));
    setDraft(nextDraft);
    setUploadFile(null);
    setCoverImage(null);
    setCoverPreview(null);
    setCoverRevision(0);
    bookმონიშვნაSaved({ draft: nextDraft, coverRevision: 0 });
  }, [detailQuery.data, bookმონიშვნაSaved]);

  const chapters = useMemo(() => {
    if (!detailQuery.data?.chapters) return [];
    return detailQuery.data.chapters.slice().sort((a, b) => a.order - b.order);
  }, [detailQuery.data?.chapters]);

  const addChapterMutation = useMutation({
    mutationFn: async () => {
      const order = chapters.length ? Math.max(...chapters.map(c => c.order)) + 1 : 1;
      return createChapter({ book: bookId, order, title: `Chapter ${order}`, body: "" });
    },
    onSuccess: (newChapter: { id: number }) => {
      queryClient.invalidateQueries({ queryKey: ["writer", "book", bookId] });
      setActiveSection(newChapter.id);
      setShowAddNav(false);
      toast({ title: "Chapter created. You can now edit it." });
    }
  });

  const statusClass = useMemo(() => {
    const status = detailQuery.data?.status;
    return status ? CONTENT_STATUS_STYLES[status] : "";
  }, [detailQuery.data?.status]);

  const currentCoverUrl = coverPreview || resolveMediaUrl(detailQuery.data?.cover_image) || null;

  if (!Number.isFinite(bookId)) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("work.book")}ს ID არასწორია.</p>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("work.book")}ს რედაქტორი იტვირთება...</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto space-y-3 px-6 py-10">
        <p className="font-ui text-sm text-red-700">{t("editor.bookLoadFailed")}</p>
        <Button variant="outline" onClick={() => navigate("/writer/new")}>{t("work.newWork")}ს შექმნა</Button>
      </div>
    );
  }

  const status = detailQuery.data.status;

  return (
    <div className="container mx-auto max-w-6xl flex flex-col gap-3 lg:space-y-6 px-3 lg:px-6 py-3 lg:py-10">
      <section className="shrink-0 rounded-2xl border border-border/70 bg-card/80 p-3 lg:p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1">
              <BookOpenText className="h-3.5 w-3.5 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">{t("work.book")}ს რედაქტორი</span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">{t("work.book")}ს რედაქტირება</h1>
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
            უარყოფის reason: {detailQuery.data.rejection_reason}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col space-y-4 lg:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm z-10">
          <Label className="font-ui shrink-0 whitespace-nowrap pl-2 text-muted-foreground">{t("editor.toc")} (რედაქტირება):</Label>
          <Select
            value={activeSection.toString()}
            onValueChange={(val) => val === "settings" || val === "foreword" || val === "afterword" ? setActiveSection(val) : setActiveSection(Number(val))}
          >
            <SelectTrigger className="font-ui flex-1 bg-background h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="settings">Overview & Settings</SelectItem>
              {(draft.foreword || activeSection === "foreword") && <SelectItem value="foreword">{t("work.foreword")} {!hasTextContent(draft.foreword) ? "(Empty)" : ""}</SelectItem>}
              {chapters.map(ch => <SelectItem key={ch.id} value={ch.id.toString()}>{ch.title || `Chapter ${ch.order}`}</SelectItem>)}
              {(draft.afterword || activeSection === "afterword") && <SelectItem value="afterword">{t("work.afterword")} {!hasTextContent(draft.afterword) ? "(Empty)" : ""}</SelectItem>}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => addChapterMutation.mutate()} disabled={addChapterMutation.isPending} size="sm" className="h-10 w-full sm:w-auto font-ui border-dashed shrink-0 bg-background hover:bg-muted">
            <Plus className="h-4 w-4 mr-2" /> Add Chapter
          </Button>
        </div>

        {/* EDITOR AREA */}
        <article className="rounded-2xl border border-border/70 bg-card/80 p-4 lg:p-6 shadow-card overflow-visible">
          {activeSection === "settings" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-5 mb-5">
                <h2 className="font-display text-2xl font-semibold text-foreground">Overview & Settings</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2 h-9"
                    onClick={async () => {
                      if (window.confirm(t("editor.deleteBookConfirm"))) {
                        try {
                          await deleteContentItem("books", bookId);
                          toast({ title: t("editor.bookDeleted") });
                          navigate("/writer/new");
                        } catch (error) {
                          toast({ variant: "destructive", title: t("work.deleteFailed") });
                        }
                      }
                    }}
                  >
                    <Trash className="h-3.5 w-3.5" /> Delete Book
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2 h-9"
                    onClick={async () => {
                      try {
                        await autosave.saveNow();
                        toast({ title: t("editor.saved") });
                      } catch (error) {
                        toast({
                          variant: "destructive",
                          title: t("editor.saveFailed"),
                          description: error instanceof Error ? error.message : "Please fix validation issues and try again.",
                        });
                      }
                    }}
                    disabled={autosave.isSaving}
                  >
                    <Save className="h-4 w-4" /> Save Book
                  </Button>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-ui">{t("work.title")}</Label>
                  <Input
                    value={draft.title}
                    onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                    className="font-ui"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-ui">{t("editor.chapterNum")}</Label>
                  <Select
                    value={draft.numbering_style}
                    onValueChange={(value) => setDraft((prev) => ({ ...prev, numbering_style: value as NumberingStyle }))}
                  >
                    <SelectTrigger className="font-ui">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="separator">{t("editor.sep")}</SelectItem>
                      <SelectItem value="arabic">{t("editor.arabic")}</SelectItem>
                      <SelectItem value="roman">{t("editor.roman")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="font-ui font-semibold text-base">{t("work.book")}ს აღწერა</Label>
                <Textarea
                  value={draft.description}
                  onChange={(e) => setDraft(p => ({ ...p, description: e.target.value }))}
                  rows={6}
                  placeholder={t("editor.shortDesc")}
                  className="font-ui text-sm resize-y"
                />

                {/* Adding new sections nav bar */}
                <div className="mt-4 rounded-xl border border-border/60 bg-background/50 p-4">
                  {!showAddNav ? (
                    <Button variant="outline" onClick={() => setShowAddNav(true)} className="gap-2 w-full border-dashed">
                      <Plus className="h-4 w-4" /> Add Section To Book
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="font-ui text-sm font-medium">{t("editor.chooseSection")}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddNav(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => { setActiveSection("foreword"); setShowAddNav(false); }}
                          disabled={Boolean(draft.foreword)}
                          className="bg-primary/10 text-primary hover:bg-primary/20 shadow-none border-primary/20"
                          variant="outline"
                        >{t("work.foreword")}</Button>
                        <Button
                          onClick={() => addChapterMutation.mutate()}
                          disabled={addChapterMutation.isPending}
                          className="bg-primary/10 text-primary hover:bg-primary/20 shadow-none border-primary/20"
                          variant="outline"
                        >
                          Chapter
                        </Button>
                        <Button
                          onClick={() => { setActiveSection("afterword"); setShowAddNav(false); }}
                          disabled={chapters.length === 0 || Boolean(draft.afterword)}
                          className="bg-primary/10 text-primary hover:bg-primary/20 shadow-none border-primary/20"
                          variant="outline"
                        >{t("work.afterword")}</Button>
                      </div>
                      {chapters.length === 0 && (
                        <p className="text-[11px] text-muted-foreground font-ui">{t("editor.afterwordReq")}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6 pt-4 border-t border-border/40">
                <div className="space-y-2">
                  <Label className="font-ui">{t("work.sourceType")} და ატვირთვის პარამეტრები</Label>
                  <Select
                    value={draft.source_type}
                    onValueChange={(value) => {
                      setDraft((prev) => ({ ...prev, source_type: value as SourceType }));
                      setUploadFile(null);
                    }}
                  >
                    <SelectTrigger className="font-ui w-full md:w-1/2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">{t("editor.manualEditor")}</SelectItem>
                      <SelectItem value="upload">{t("work.fileUpload")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {draft.source_type === "upload" && (
                  <div className="space-y-3 rounded-lg border border-border/40 bg-background/50 p-4">
                    <div>
                      <Label htmlFor="bookUpload" className="font-ui">{t("editor.docUpload")}</Label>
                      <Input
                        id="bookUpload"
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                        className="mt-2"
                      />
                      <p className="mt-2 font-ui text-[11px] text-muted-foreground">{t("editor.allowed")}: PDF, DOC, DOCX, TXT (მაქს. 20MB).</p>
                    </div>

                    {detailQuery.data.upload_file ? (
                      <p className="font-ui text-sm text-muted-foreground">
                        Current file:{" "}
                        <a className="underline" href={detailQuery.data.upload_file} target="_blank" rel="noreferrer">{t("editor.openFile")}</a>
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
                  <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-4 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="bookAnonymousToggle" className="font-ui text-sm">{t("editor.publishAnon")}</Label>
                        <p className="font-ui text-[11px] text-muted-foreground">
                          Hidden from readers. Visible to admins.
                        </p>
                      </div>
                      <Switch
                        id="bookAnonymousToggle"
                        checked={draft.is_anonymous}
                        onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_anonymous: checked }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-4 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="bookHiddenToggle" className="font-ui text-sm">{t("editor.hiddenPub")}</Label>
                        <p className="font-ui text-[11px] text-muted-foreground">{t("editor.hiddenDesc")}</p>
                      </div>
                      <Switch
                        id="bookHiddenToggle"
                        checked={draft.is_hidden}
                        onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_hidden: checked }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-display text-base font-semibold text-foreground">{t("editor.coverImage")}</h3>
                    <p className="font-ui text-xs text-muted-foreground">{t("editor.coverVisible")} JPG, PNG, WEBP — მაქს. 5MB.</p>
                  </div>
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
                        id="bookCoverImageInput"
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
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium font-ui transition-colors hover:border-primary/40 hover:text-primary w-fit"
                      >
                        <ImagePlus className="h-4 w-4" />
                        {currentCoverUrl ? "Change cover" : "Upload cover"}
                      </button>
                      {coverImage && (
                        <p className="font-ui text-xs text-muted-foreground">{t("editor.selected")} {coverImage.name} (შეინახება შემდეგ შენახვაზე)</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "foreword" && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
                <h2 className="font-display text-2xl font-semibold text-foreground">{t("editor.editForeword")}</h2>
                <Button
                  className="gap-2"
                  onClick={async () => {
                    try {
                      await autosave.saveNow();
                      toast({ title: t("editor.forewordSaved") });
                    } catch (error) {
                      toast({ variant: "destructive", title: t("editor.saveFailed") });
                    }
                  }}
                  disabled={autosave.isSaving}
                >
                  <Save className="h-4 w-4" /> Save
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="font-ui">{t("editor.forewordText")}</Label>
                <RichTextEditor value={draft.foreword} onChange={(foreword) => setDraft(p => ({ ...p, foreword }))} minHeightClass="min-h-[420px]" placeholder={t("editor.writeForeword")} />
              </div>
            </div>
          )}

          {activeSection === "afterword" && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
                <h2 className="font-display text-2xl font-semibold text-foreground">{t("editor.editAfterword")}</h2>
                <Button
                  className="gap-2"
                  onClick={async () => {
                    try {
                      await autosave.saveNow();
                      toast({ title: t("editor.afterwordSaved") });
                    } catch (error) {
                      toast({ variant: "destructive", title: t("editor.saveFailed") });
                    }
                  }}
                  disabled={autosave.isSaving}
                >
                  <Save className="h-4 w-4" /> Save
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="font-ui">{t("editor.afterwordText")}</Label>
                <RichTextEditor value={draft.afterword} onChange={(afterword) => setDraft(p => ({ ...p, afterword }))} minHeightClass="min-h-[420px]" placeholder={t("editor.writeAfterword")} />
              </div>
            </div>
          )}

          {typeof activeSection === "number" && (
            <ChapterEditorInline chapterId={activeSection} bookId={bookId} onDelete={() => setActiveSection("settings")} />
          )}

        </article>
      </section>

    </div>
  );
};

export default WriterBookEditorPage;





