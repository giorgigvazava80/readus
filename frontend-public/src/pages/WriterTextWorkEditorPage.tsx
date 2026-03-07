import { useI18n } from "@/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Feather, FileText, ImagePlus, X, Trash, AlignLeft, Settings, ChevronRight, Menu } from "lucide-react";

import RichTextEditor from "@/components/editor/RichTextEditor";
import SaveStateBadge from "@/components/editor/SaveStateBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useConfirm } from "@/components/ui/confirm-dialog";
import { buildFacebookShareIntent, fetchContentDetail, resolveMediaUrl, updatePoem, updateStory, deleteContentItem } from "@/lib/api";
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
  const { confirm } = useConfirm();
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
  const [activeSection, setActiveSection] = useState<"settings" | "body">("settings");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);


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
  const inviteKey = `invite-modal:${type}:${contentId}:${detailQuery.data?.updated_at || ""}`;
  const inviteLink = detailQuery.data?.public_slug
    ? `${window.location.origin}/read/${type}/${detailQuery.data.public_slug}?ref=${encodeURIComponent(`@${detailQuery.data.author_username || ""}`)}`
    : "";

  useEffect(() => {
    const status = detailQuery.data?.status;
    if (status !== "approved") return;
    if (sessionStorage.getItem(inviteKey)) return;
    sessionStorage.setItem(inviteKey, "1");
    setInviteOpen(true);
  }, [detailQuery.data?.status, inviteKey]);


  <div className="container mx-auto px-6 py-10">
    <p className="font-ui text-sm text-muted-foreground">{t("editor.invalidId")}</p>
  </div>

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

  let activeSectionLabel = "Editor";
  if (activeSection === "settings") {
    activeSectionLabel = t("editor.overviewSettings");
  } else if (activeSection === "body") {
    activeSectionLabel = draft.source_type === "upload" ? t("work.fileUpload") : (type === "poems" ? t("editor.poemText") : t("editor.storyText"));
  }

  const navItems = [
    {
      value: "settings",
      label: t("editor.overviewSettings"),
      hint: t("editor.editStoryDesc"), // fallback or just generic hint if needed
      icon: <Settings className="h-4 w-4 shrink-0" />,
    },
    {
      value: "body",
      label: draft.source_type === "upload" ? t("work.fileUpload") : (type === "poems" ? t("editor.poemText") : t("editor.storyText")),
      hint: draft.source_type === "upload" ? t("editor.uploadDoc") : t("editor.richTextBody"),
      icon: <Icon className="h-4 w-4 shrink-0" />,
    }
  ];

  const navigateToSection = (val: "settings" | "body") => {
    setActiveSection(val);
    setSidebarOpen(false);
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div
        data-editor-header-anchor="true"
        className="pointer-events-none absolute left-0 top-0 h-14 w-full opacity-0 sm:hidden"
        aria-hidden="true"
      />
      {/* ─── Mobile top bar ─────────────────────────────────── */}
      <div className="sticky top-0 z-30 flex sm:hidden items-center gap-2 border-b border-border/70 bg-background/95 backdrop-blur px-3 py-2 shadow-sm">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center h-11 w-11 rounded-xl border border-border/70 bg-card/80 text-foreground transition-colors active:bg-muted"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-ui text-xs text-muted-foreground truncate">{type === "poems" ? t("editor.poemLabel") : t("editor.storyLabel")}</p>
          <p className="font-ui text-sm font-semibold text-foreground truncate">{activeSectionLabel}</p>
        </div>
        <SaveStateBadge
          isSaving={autosave.isSaving}
          hasUnsavedChanges={autosave.hasUnsavedChanges}
          lastSavedAt={autosave.lastSavedAt}
          lastError={autosave.lastError}
        />
      </div>

      {/* ─── Mobile slide-in sidebar overlay ────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex sm:hidden">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* panel */}
          <div className="relative z-50 flex flex-col w-[80vw] max-w-xs bg-card border-r border-border/70 shadow-xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-ui text-sm font-semibold">{type === "poems" ? t("editor.poemLabel") : t("editor.storyLabel")}</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {navItems.map(item => (
                <button
                  key={item.value}
                  onClick={() => navigateToSection(item.value as "settings" | "body")}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors active:bg-muted/80 ${activeSection.toString() === item.value
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-foreground hover:bg-muted/50"
                    }`}
                >
                  <span className={`mt-0.5 ${activeSection === item.value ? "text-primary" : "text-muted-foreground"}`}>
                    {item.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-ui text-sm font-medium truncate">{item.label}</span>
                    {item.hint && <span className="block font-ui text-xs text-muted-foreground">{item.hint}</span>}
                  </span>
                  {activeSection === item.value && <ChevronRight className="h-4 w-4 shrink-0 text-primary mt-0.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Main layout ────────────────────────────────────── */}
      <div className="container mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-3 sm:py-5 lg:py-8">

        {/* Desktop/Tablet page header */}
        <header data-editor-header-anchor="true" className="hidden sm:flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1 mb-2">
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">{type === "poems" ? t("editor.poemLabel") : t("editor.storyLabel")}</span>
            </div>
            <h1 className="font-display text-2xl lg:text-3xl font-semibold text-foreground">{draft.title || t("editor.untitled")}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusClass}>
                {detailQuery.data?.status ? t("status." + detailQuery.data.status, detailQuery.data.status) : ""}
              </Badge>
              <SaveStateBadge
                isSaving={autosave.isSaving}
                hasUnsavedChanges={autosave.hasUnsavedChanges}
                lastSavedAt={autosave.lastSavedAt}
                lastError={autosave.lastError}
              />
            </div>
          </div>
        </header>

        {/* ─── Tablet pill navigation ──────────────────────── */}
        <nav className="hidden sm:flex lg:hidden items-center gap-2 overflow-x-auto pb-2 mb-4">
          {navItems.map(item => (
            <button
              key={item.value}
              onClick={() => navigateToSection(item.value as "settings" | "body")}
              className={`flex items-center gap-1.5 shrink-0 rounded-full px-4 h-10 font-ui text-sm font-medium transition-colors whitespace-nowrap border ${activeSection === item.value
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/70 text-foreground hover:border-primary/40 hover:text-primary"
                }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* ─── Desktop two-column layout ───────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex flex-col w-56 lg:w-60 shrink-0">
            <div className="sticky top-6 flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-card">
              <p className="font-ui text-xs text-muted-foreground px-2 pt-1 pb-0.5 uppercase tracking-wide">{t("editor.sections")}</p>
              <nav className="flex flex-col gap-0.5">
                {navItems.map(item => (
                  <button
                    key={item.value}
                    onClick={() => navigateToSection(item.value as "settings" | "body")}
                    className={`flex items-start gap-2.5 w-full rounded-xl px-3 py-2.5 text-left transition-colors ${activeSection === item.value
                      ? "bg-primary/12 text-primary"
                      : "text-foreground hover:bg-muted/60"
                      }`}
                  >
                    <span className={`mt-0.5 shrink-0 ${activeSection === item.value ? "text-primary" : "text-muted-foreground"}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-ui text-sm font-medium truncate">{item.label}</span>
                      {item.hint && <span className="block font-ui text-xs text-muted-foreground truncate">{item.hint}</span>}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* ─── Editor area ──────────────────────────────────── */}
          <main className="flex-1 min-w-0 flex flex-col gap-4 pb-24 sm:pb-6">

            {/* Rejection notice */}
            {detailQuery.data.rejection_reason && (
              <div className="rounded-xl border border-red-500/35 bg-red-500/10 p-4 font-ui text-sm text-red-700">
                <p className="font-semibold mb-1">{t("editor.rejectionReason")}</p>
                <p>{detailQuery.data.rejection_reason}</p>
              </div>
            )}

            <article className="rounded-2xl border border-border/70 bg-card/80 p-4 sm:p-5 lg:p-6 shadow-card">

              {/* ── SETTINGS ─────────────────────────────────── */}
              {activeSection === "settings" && (
                <div className="space-y-7 animate-in fade-in duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-5">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground">{t("editor.overviewSettings")}</h2>
                      <p className="mt-1 font-ui text-sm text-muted-foreground">
                        {type === "poems" ? t("editor.editPoemDesc") : t("editor.editStoryDesc")}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2 h-10"
                        onClick={async () => {
                          const label = type === "stories" ? "story" : "poem";
                          if (await confirm({ title: t("confirm.deleteTitle"), description: t("confirm.deleteDesc"), destructive: true, confirmText: t("confirm.delete") })) {
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
                        <Trash className="h-3.5 w-3.5" /> {t("editor.delete")}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="font-ui text-sm font-medium">{t("work.title")}</Label>
                    <Input
                      value={draft.title}
                      onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                      className="font-ui h-11 text-base"
                    />
                  </div>

                  <div className="space-y-4">
                    <Label className="font-ui text-sm font-medium">
                      {type === "poems" ? t("editor.poemDescLabel") : t("editor.storyDescLabel")}
                    </Label>
                    <Textarea
                      value={draft.description}
                      onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      placeholder={t("editor.shortDescView")}
                      className="font-ui text-sm resize-y"
                    />
                  </div>

                  <div className="space-y-5 pt-4 border-t border-border/40">
                    <div className="space-y-2">
                      <Label className="font-ui text-sm font-medium">{t("work.sourceType")}</Label>
                      <Select
                        value={draft.source_type}
                        onValueChange={(value) => {
                          setDraft((prev) => ({ ...prev, source_type: value as SourceType }));
                          setUploadFile(null);
                        }}
                      >
                        <SelectTrigger className="font-ui h-11 w-full sm:w-1/2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">{t("work.manualWrite")}</SelectItem>
                          <SelectItem value="upload">{t("work.fileUpload")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-5 pt-4 border-t border-border/40">
                    <h3 className="font-ui text-sm font-medium">{t("editor.coverImage")}</h3>
                    <div className="flex flex-wrap items-start gap-5">
                      {currentCoverUrl ? (
                        <div className="group relative flex-shrink-0">
                          <img
                            src={currentCoverUrl || ""}
                            alt="Cover preview"
                            className="h-44 w-32 rounded-xl border object-cover shadow-card"
                          />
                          <button
                            onClick={() => {
                              setCoverImage(null);
                              setCoverPreview(null);
                              if (coverInputRef.current) coverInputRef.current.value = "";
                              setCoverRevision((prev) => prev + 1);
                            }}
                            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex h-44 w-32 flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
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
                          {currentCoverUrl ? t("editor.changeCover") : t("editor.uploadCover")}
                        </button>
                        <p className="font-ui text-xs text-muted-foreground">JPG, PNG, WEBP, GIF — Max size 5MB.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border/40">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4 bg-background/30">
                      <div className="space-y-0.5">
                        <Label htmlFor="textAnonymousToggle" className="font-ui text-sm font-medium">{t("editor.publishAnon")}</Label>
                        <p className="font-ui text-xs text-muted-foreground">{t("editor.hiddenFromReaders")}</p>
                      </div>
                      <Switch
                        id="textAnonymousToggle"
                        checked={draft.is_anonymous}
                        onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_anonymous: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4 bg-background/30">
                      <div className="space-y-0.5">
                        <Label htmlFor="textHiddenToggle" className="font-ui text-sm font-medium">{t("editor.hiddenPub")}</Label>
                        <p className="font-ui text-xs text-muted-foreground">{t("editor.linkSharingOnly")}</p>
                      </div>
                      <Switch
                        id="textHiddenToggle"
                        checked={draft.is_hidden}
                        onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_hidden: checked }))}
                      />
                    </div>
                  </div>

                  {/* Navigation Button */}
                  <div className="pt-6 border-t border-border/40 flex justify-center">
                    <Button
                      variant="outline"
                      className="gap-2 px-8 h-12 rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all text-primary font-ui"
                      onClick={() => setActiveSection("body")}
                    >
                      {t("editor.goToContent")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Mobile delete button */}
                  <div className="sm:hidden pt-2 border-t border-border/40">
                    <Button
                      variant="destructive"
                      className="w-full h-11 gap-2 font-ui"
                      onClick={async () => {
                        const label = type === "stories" ? "story" : "poem";
                        if (await confirm({ title: t("confirm.deleteTitle"), description: t("confirm.deleteDesc"), destructive: true, confirmText: t("confirm.delete") })) {
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
                      <Trash className="h-4 w-4" /> {type === "stories" ? t("editor.deleteStory") : t("editor.deletePoem")}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── BODY ─────────────────────────────────────── */}
              {activeSection === "body" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4 mb-4">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground">
                        {draft.source_type === "upload" ? t("work.fileUpload", "File Upload") : (type === "poems" ? t("editor.poemText", "Poem Text") : t("editor.storyText", "Story Text"))}
                      </h2>
                    </div>
                    {/* Desktop action buttons */}
                    <div className="hidden sm:flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2 h-10"
                        onClick={async () => {
                          const label = type === "stories" ? "story" : "poem";
                          if (await confirm({ title: t("confirm.deleteTitle"), description: t("confirm.deleteDesc"), destructive: true, confirmText: t("confirm.delete") })) {
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
                        <Trash className="h-3.5 w-3.5" /> {type === "stories" ? t("editor.deleteStory") : t("editor.deletePoem")}
                      </Button>
                    </div>
                  </div>

                  {draft.source_type === "upload" ? (
                    <div className="space-y-4">
                      <Label htmlFor="textWorkUpload" className="font-ui text-base font-medium">{t("work.fileUpload")}</Label>
                      <div className="mt-3 rounded-xl border-2 border-dashed border-border/70 bg-background/60 p-6 text-center transition-colors hover:border-primary/40">
                        <FileText className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                        <Input
                          id="textWorkUpload"
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          className="mx-auto max-w-sm"
                          onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                        />
                        <p className="mt-3 font-ui text-xs text-muted-foreground">{t("editor.allowed")}: PDF, DOC, DOCX, TXT (Max 20MB)</p>
                      </div>

                      {detailQuery.data.upload_file && (
                        <div className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-primary font-ui text-sm">
                          <FileText className="h-4 w-4" />
                          <span>{t("editor.currentFile")}</span>
                          <a className="font-semibold underline underline-offset-2 hover:text-primary/80" href={detailQuery.data.upload_file} target="_blank" rel="noreferrer">{t("editor.openFile")}</a>
                        </div>
                      )}

                      {!detailQuery.data.upload_file && !uploadFile && (
                        <div className="inline-flex items-center gap-2 rounded-lg bg-orange-500/10 px-4 py-2 text-orange-600 font-ui text-sm">
                          <span className="font-semibold text-lg leading-none">!</span>
                          {t("editor.uploadBeforeSave")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-xl border border-border/50 overflow-hidden">
                        <RichTextEditor
                          value={draft.body}
                          onChange={(body: string) => setDraft((prev: any) => ({ ...prev, body }))}
                          minHeightClass="min-h-[500px]"
                          placeholder={type === "poems" ? t("editor.startPoem") : t("editor.startStory")}
                          isPoem={type === "poems"}
                        />
                      </div>
                    </div>
                  )}

                  {/* Mobile delete button */}
                  <div className="sm:hidden mt-4 pt-4 border-t border-border/40">
                    <Button
                      variant="destructive"
                      className="w-full h-11 gap-2 font-ui"
                      onClick={async () => {
                        const label = type === "stories" ? "story" : "poem";
                        if (await confirm({ title: t("confirm.deleteTitle"), destructive: true, confirmText: t("confirm.delete") })) {
                          deleteContentItem(type, contentId).then(() => { navigate("/writer/new") });
                        }
                      }}
                    >
                      <Trash className="h-4 w-4" /> {type === "stories" ? t("editor.deleteStory") : t("editor.deletePoem")}
                    </Button>
                  </div>
                </div>
              )}

            </article>

          </main>
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share to get your first 100 reads</DialogTitle>
            <DialogDescription>
              Invite readers right after publish and track reads from shares in analytics.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!inviteLink) return;
                await navigator.clipboard.writeText(inviteLink);
              }}
            >
              Copy link
            </Button>
            {inviteLink ? (
              <a href={buildFacebookShareIntent(inviteLink)} target="_blank" rel="noreferrer">
                <Button>Share to Facebook</Button>
              </a>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WriterTextWorkEditorPage;
