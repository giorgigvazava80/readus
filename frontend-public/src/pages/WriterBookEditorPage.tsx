import { useI18n } from "@/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BookOpenText, ImagePlus, X, Plus, Trash, Save, ChevronDown, Settings, FileText, AlignLeft, ChevronRight, Menu } from "lucide-react";

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
import { useConfirm } from "@/components/ui/confirm-dialog";

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
// Chapter Editor Component
// ──────────────────────────────────────────────────────────
function ChapterEditorInline({ chapterId, bookId, onDelete }: { chapterId: number, bookId: number, onDelete: () => void }) {
  const { t } = useI18n();
  const { confirm } = useConfirm();
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

  const { markSaved: chaptermarkSaved } = autosave;
  useEffect(() => {
    if (detailQuery.data) {
      const nextDraft = {
        title: detailQuery.data.title || "",
        order: detailQuery.data.order || 1,
        body: detailQuery.data.body || "",
      };
      setDraft(nextDraft);
      chaptermarkSaved(nextDraft);
    }
  }, [detailQuery.data, chaptermarkSaved]);

  if (detailQuery.isLoading) {
    return <p className="font-ui text-sm text-muted-foreground p-6">{t("work.chapter")} იტვირთება...</p>;
  }
  if (!detailQuery.data) {
    return <p className="font-ui text-sm text-red-700 p-6">{t("work.chapter")}ს ჩატვირთვა ვერ მოხერხდა.</p>;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Chapter header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground leading-tight">
            {t("work.chapter")}ს რედაქტირება
          </h2>
          <Badge variant="outline" className={CONTENT_STATUS_STYLES[detailQuery.data.status] || ""}>{detailQuery.data.status}</Badge>
          <div className="hidden sm:block">
            <SaveStateBadge
              isSaving={autosave.isSaving}
              hasUnsavedChanges={autosave.hasUnsavedChanges}
              lastSavedAt={autosave.lastSavedAt}
              lastError={autosave.lastError}
            />
          </div>
        </div>
      </div>

      {detailQuery.data.rejection_reason && (
        <p className="rounded-lg border border-red-500/35 bg-red-500/10 p-3 font-ui text-sm text-red-700">
          უარყოფის მიზეზი: {detailQuery.data.rejection_reason}
        </p>
      )}

      {/* Title & Order */}
      <section className="flex flex-row items-end gap-3">
        <div className="flex-1 space-y-1.5 min-w-0">
          <Label className="font-ui text-sm font-medium">{t("work.title")} <span className="text-muted-foreground font-normal">(არასავალდებულო)</span></Label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft(p => ({ ...p, title: e.target.value }))}
            className="font-ui h-11 text-base"
            placeholder="თავის სათაური..."
          />
        </div>
        <div className="w-20 sm:w-28 space-y-1.5 shrink-0">
          <Label className="font-ui text-sm font-medium">{t("editor.order")}</Label>
          <Input
            type="number"
            min={1}
            value={draft.order}
            onChange={(e) => setDraft(p => ({ ...p, order: Math.max(1, Number(e.target.value || 1)) }))}
            className="font-ui h-11 text-base"
          />
        </div>
      </section>

      {/* Body */}
      <section className="flex flex-col space-y-1.5">
        <Label className="font-ui text-sm font-medium">{t("editor.chapterText")}</Label>
        <RichTextEditor
          value={draft.body}
          onChange={(body) => setDraft(p => ({ ...p, body }))}
          minHeightClass="min-h-[300px] sm:min-h-[420px]"
          placeholder={t("editor.startChapter")}
        />
      </section>

      {/* Desktop action buttons (mobile uses sticky bar) */}
      <div className="hidden sm:flex items-center justify-end gap-3 pt-2">
        <Button variant="destructive" size="sm" onClick={async () => {
          if (await confirm({ title: t("confirm.deleteChapter"), description: t("confirm.deleteChapterDesc"), destructive: true, confirmText: t("confirm.delete") })) {
            deleteMutation.mutate();
          }
        }} className="gap-2 h-10" disabled={deleteMutation.isPending}>
          <Trash className="h-3.5 w-3.5" /> {deleteMutation.isPending ? t("editor.deleting") : t("editor.delete")}
        </Button>
        <Button
          className="gap-2 h-10"
          size="sm"
          onClick={async () => {
            try {
              await autosave.saveNow();
              toast({ title: t("editor.chapterSaved") });
            } catch {
              toast({ variant: "destructive", title: t("editor.saveFailed") });
            }
          }}
          disabled={autosave.isSaving}
        >
          <Save className="h-4 w-4" /> {t("editor.save")}
        </Button>
      </div>

      {/* Mobile delete button (save is in sticky bar) */}
      <div className="flex sm:hidden">
        <Button variant="destructive" size="sm" onClick={async () => {
          if (await confirm({ title: t("confirm.deleteChapter"), destructive: true, confirmText: t("confirm.delete") })) {
            deleteMutation.mutate();
          }
        }} className="gap-2 h-11 w-full text-sm" disabled={deleteMutation.isPending}>
          <Trash className="h-4 w-4" /> {deleteMutation.isPending ? t("editor.deleting") : t("editor.delete")}
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
  const { confirm } = useConfirm();
  const { id } = useParams();
  const bookId = Number(id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // mobile sidebar open state
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  useEffect(() => {
    const chapterId = searchParams.get("chapter");
    if (chapterId) {
      const parsed = parseInt(chapterId, 10);
      if (Number.isFinite(parsed)) {
        setActiveSection(parsed);
      }
      // Clean up URL so it doesn't get stuck
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("chapter");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  const { markSaved: bookmarkSaved } = autosave;
  useEffect(() => {
    if (!detailQuery.data) return;
    const nextDraft = toDraft(detailQuery.data, t("editor.untitledBook"));
    setDraft(nextDraft);
    setUploadFile(null);
    setCoverImage(null);
    setCoverPreview(null);
    setCoverRevision(0);
    bookmarkSaved({ draft: nextDraft, coverRevision: 0 });
  }, [detailQuery.data, bookmarkSaved]);

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
      setSidebarOpen(false);
      toast({ title: "Chapter created. You can now edit it." });
    }
  });

  const statusClass = useMemo(() => {
    const status = detailQuery.data?.status;
    return status ? CONTENT_STATUS_STYLES[status] : "";
  }, [detailQuery.data?.status]);

  const currentCoverUrl = coverPreview || resolveMediaUrl(detailQuery.data?.cover_image) || null;

  // Helper: human-readable label for active section
  const activeSectionLabel = useMemo(() => {
    if (activeSection === "settings") return "Overview & Settings";
    if (activeSection === "foreword") return t("work.foreword");
    if (activeSection === "afterword") return t("work.afterword");
    const ch = chapters.find(c => c.id === activeSection);
    return ch ? (ch.title || `Chapter ${ch.order}`) : "Editor";
  }, [activeSection, chapters, t]);

  // Handle save action (works for both book settings and chapter)
  const handleSave = async () => {
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
  };

  const navigateToSection = (val: string) => {
    if (val === "settings" || val === "foreword" || val === "afterword") {
      setActiveSection(val);
    } else {
      setActiveSection(Number(val));
    }
    setSidebarOpen(false);
  };

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

  // ── Nav items (only foreword/afterword shown if they have content) ──
  const hasForeword = hasTextContent(draft.foreword);
  const hasAfterword = hasTextContent(draft.afterword);

  const navItems: Array<{ value: string; label: string; hint?: string; icon: React.ReactNode; canClear?: boolean }> = [
    {
      value: "settings",
      label: "Overview & Settings",
      hint: "Title, cover, description",
      icon: <Settings className="h-4 w-4 shrink-0" />,
    },
    ...(hasForeword
      ? [{
        value: "foreword",
        label: t("work.foreword"),
        hint: undefined,
        icon: <FileText className="h-4 w-4 shrink-0" />,
        canClear: true,
      }]
      : []),
    ...chapters.map(ch => ({
      value: ch.id.toString(),
      label: ch.title || `Chapter ${ch.order}`,
      hint: `Order ${ch.order}`,
      icon: <AlignLeft className="h-4 w-4 shrink-0" />,
    })),
    ...(hasAfterword
      ? [{
        value: "afterword",
        label: t("work.afterword"),
        hint: undefined,
        icon: <FileText className="h-4 w-4 shrink-0" />,
        canClear: true,
      }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background">

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
          <p className="font-ui text-xs text-muted-foreground truncate">{t("work.book")}ს რედაქტორი</p>
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
                <BookOpenText className="h-4 w-4 text-primary" />
                <span className="font-ui text-sm font-semibold">{t("work.book")}ს სექციები</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {navItems.map(item => (
                <button
                  key={item.value}
                  onClick={() => navigateToSection(item.value)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors active:bg-muted/80 ${activeSection.toString() === item.value
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-foreground hover:bg-muted/50"
                    }`}
                >
                  <span className={`mt-0.5 ${activeSection.toString() === item.value ? "text-primary" : "text-muted-foreground"}`}>
                    {item.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-ui text-sm font-medium truncate">{item.label}</span>
                    {item.hint && <span className="block font-ui text-xs text-muted-foreground">{item.hint}</span>}
                  </span>
                  {activeSection.toString() === item.value && <ChevronRight className="h-4 w-4 shrink-0 text-primary mt-0.5" />}
                </button>
              ))}
            </div>
            {/* Add chapter + optional sections in mobile sidebar */}
            <div className="p-3 border-t border-border/40 space-y-2">
              <Button
                onClick={() => addChapterMutation.mutate()}
                disabled={addChapterMutation.isPending}
                className="w-full gap-2 h-11 font-ui text-sm border-dashed"
                variant="outline"
              >
                <Plus className="h-4 w-4" /> Add Chapter
              </Button>
              {!hasForeword && (
                <button
                  onClick={() => { setActiveSection("foreword"); setSidebarOpen(false); }}
                  className="flex items-center gap-2 w-full rounded-xl px-3 py-2.5 text-left font-ui text-xs text-muted-foreground border border-dashed border-border/50 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add {t("work.foreword")}
                </button>
              )}
              {!hasAfterword && (
                <button
                  disabled={chapters.length === 0}
                  onClick={() => { setActiveSection("afterword"); setSidebarOpen(false); }}
                  className="flex items-center gap-2 w-full rounded-xl px-3 py-2.5 text-left font-ui text-xs text-muted-foreground border border-dashed border-border/50 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3 w-3" /> Add {t("work.afterword")}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ─── Main layout ────────────────────────────────────── */}
      <div className="container mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-3 sm:py-5 lg:py-8">

        {/* Desktop/Tablet page header */}
        <header className="hidden sm:flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1 mb-2">
              <BookOpenText className="h-3.5 w-3.5 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">{t("work.book")}ს რედაქტორი</span>
            </div>
            <h1 className="font-display text-2xl lg:text-3xl font-semibold text-foreground">{draft.title || t("editor.untitledBook")}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusClass}>{status}</Badge>
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
        <nav className="hidden sm:flex lg:hidden items-center gap-2 overflow-x-auto scrollbar-none pb-2 mb-4">
          {navItems.map(item => (
            <button
              key={item.value}
              onClick={() => navigateToSection(item.value)}
              className={`flex items-center gap-1.5 shrink-0 rounded-full px-4 h-10 font-ui text-sm font-medium transition-colors whitespace-nowrap border ${activeSection.toString() === item.value
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/70 text-foreground hover:border-primary/40 hover:text-primary"
                }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <button
            onClick={() => addChapterMutation.mutate()}
            disabled={addChapterMutation.isPending}
            className="flex items-center gap-1.5 shrink-0 rounded-full px-4 h-10 font-ui text-sm font-medium border border-dashed border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" /> Add Chapter
          </button>
        </nav>

        {/* ─── Desktop two-column layout ───────────────────── */}
        <div className="flex gap-6">

          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex flex-col w-60 shrink-0">
            <div className="sticky top-6 flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-card">
              <p className="font-ui text-xs text-muted-foreground px-2 pt-1 pb-0.5 uppercase tracking-wide">სექციები</p>
              <nav className="flex flex-col gap-0.5">
                {navItems.map(item => (
                  <button
                    key={item.value}
                    onClick={() => navigateToSection(item.value)}
                    className={`flex items-start gap-2.5 w-full rounded-xl px-3 py-2.5 text-left transition-colors ${activeSection.toString() === item.value
                      ? "bg-primary/12 text-primary"
                      : "text-foreground hover:bg-muted/60"
                      }`}
                  >
                    <span className={`mt-0.5 shrink-0 ${activeSection.toString() === item.value ? "text-primary" : "text-muted-foreground"}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-ui text-sm font-medium truncate">{item.label}</span>
                      {item.hint && <span className="block font-ui text-xs text-muted-foreground truncate">{item.hint}</span>}
                    </span>
                  </button>
                ))}
              </nav>

              <div className="pt-1 border-t border-border/40">
                <Button
                  onClick={() => addChapterMutation.mutate()}
                  disabled={addChapterMutation.isPending}
                  className="w-full gap-2 h-10 font-ui text-sm border-dashed"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" /> Add Chapter
                </Button>
              </div>

              {/* Add section shortcuts */}
              {/* Ghost add-buttons for foreword/afterword */}
              <div className="pt-1 border-t border-border/40 space-y-0.5">
                {!hasForeword && (
                  <button
                    onClick={() => { setActiveSection("foreword"); }}
                    className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-left font-ui text-xs text-muted-foreground border border-dashed border-border/50 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add {t("work.foreword")}
                  </button>
                )}
                {!hasAfterword && (
                  <button
                    disabled={chapters.length === 0}
                    onClick={() => { setActiveSection("afterword"); }}
                    className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-left font-ui text-xs text-muted-foreground border border-dashed border-border/50 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3 w-3" /> Add {t("work.afterword")}
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* ─── Editor area ──────────────────────────────────── */}
          <main className="flex-1 min-w-0 flex flex-col gap-4 pb-24 sm:pb-6">

            {/* Rejection notice */}
            {detailQuery.data.rejection_reason && (
              <div className="rounded-xl border border-red-500/35 bg-red-500/10 p-4 font-ui text-sm text-red-700">
                <p className="font-semibold mb-1">უარყოფის მიზეზი</p>
                <p>{detailQuery.data.rejection_reason}</p>
              </div>
            )}

            <article className="rounded-2xl border border-border/70 bg-card/80 p-4 sm:p-5 lg:p-6 shadow-card">

              {/* ── SETTINGS ─────────────────────────────────── */}
              {activeSection === "settings" && (
                <div className="space-y-7 animate-in fade-in duration-300">
                  {/* Section header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-5">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground">Overview & Settings</h2>
                      <p className="mt-1 font-ui text-sm text-muted-foreground">Edit your book's title, cover, description and settings</p>
                    </div>
                    {/* Desktop action buttons */}
                    <div className="hidden sm:flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2 h-10"
                        onClick={async () => {
                          if (await confirm({ title: t("editor.deleteBookConfirm"), description: "This action cannot be undone.", destructive: true, confirmText: "Delete Book" })) {
                            try {
                              await deleteContentItem("books", bookId);
                              toast({ title: t("editor.bookDeleted") });
                              navigate("/writer/new");
                            } catch {
                              toast({ variant: "destructive", title: t("work.deleteFailed") });
                            }
                          }
                        }}
                      >
                        <Trash className="h-3.5 w-3.5" /> Delete Book
                      </Button>
                      <Button size="sm" className="gap-2 h-10" onClick={handleSave} disabled={autosave.isSaving}>
                        <Save className="h-4 w-4" /> Save Book
                      </Button>
                    </div>
                  </div>

                  {/* Title & Numbering */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="font-ui text-sm font-medium">{t("work.title")}</Label>
                      <Input
                        value={draft.title}
                        onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                        className="font-ui h-11 text-base"
                        placeholder={t("editor.untitledBook")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-ui text-sm font-medium">{t("editor.chapterNum")}</Label>
                      <Select
                        value={draft.numbering_style}
                        onValueChange={(value) => setDraft((prev) => ({ ...prev, numbering_style: value as NumberingStyle }))}
                      >
                        <SelectTrigger className="font-ui h-11">
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

                  {/* Description */}
                  <div className="space-y-2">
                    <Label className="font-ui text-sm font-medium">{t("work.book")}ს აღწერა</Label>
                    <Textarea
                      value={draft.description}
                      onChange={(e) => setDraft(p => ({ ...p, description: e.target.value }))}
                      rows={5}
                      placeholder={t("editor.shortDesc")}
                      className="font-ui text-sm resize-y"
                    />
                  </div>

                  {/* Inline ghost section adders (tablet only — desktop has sidebar, mobile has drawer) */}
                  <div className="lg:hidden flex flex-wrap gap-2">
                    {!hasForeword && (
                      <Button
                        onClick={() => setActiveSection("foreword")}
                        variant="outline"
                        className="gap-2 h-10 border-dashed font-ui text-sm text-muted-foreground hover:text-primary hover:border-primary/40"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add {t("work.foreword")}
                      </Button>
                    )}
                    {!hasAfterword && (
                      <Button
                        onClick={() => setActiveSection("afterword")}
                        disabled={chapters.length === 0}
                        variant="outline"
                        className="gap-2 h-10 border-dashed font-ui text-sm text-muted-foreground hover:text-primary hover:border-primary/40"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add {t("work.afterword")}
                      </Button>
                    )}
                  </div>

                  {/* Source type / upload */}
                  <div className="space-y-5 pt-4 border-t border-border/40">
                    <div className="space-y-2">
                      <Label className="font-ui text-sm font-medium">{t("work.sourceType")} და ატვირთვის პარამეტრები</Label>
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
                          <SelectItem value="manual">{t("editor.manualEditor")}</SelectItem>
                          <SelectItem value="upload">{t("work.fileUpload")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {draft.source_type === "upload" && (
                      <div className="space-y-3 rounded-xl border border-border/40 bg-background/50 p-4">
                        <div>
                          <Label htmlFor="bookUpload" className="font-ui text-sm font-medium">{t("editor.docUpload")}</Label>
                          <Input
                            id="bookUpload"
                            type="file"
                            accept=".pdf,.doc,.docx,.txt"
                            onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                            className="mt-2 h-11"
                          />
                          <p className="mt-2 font-ui text-xs text-muted-foreground">{t("editor.allowed")}: PDF, DOC, DOCX, TXT (მაქს. 20MB).</p>
                        </div>
                        {detailQuery.data.upload_file && (
                          <p className="font-ui text-sm text-muted-foreground">
                            Current file:{" "}
                            <a className="underline text-primary" href={detailQuery.data.upload_file} target="_blank" rel="noreferrer">{t("editor.openFile")}</a>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Toggles */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="bookAnonymousToggle" className="font-ui text-sm font-medium cursor-pointer">{t("editor.publishAnon")}</Label>
                            <p className="font-ui text-xs text-muted-foreground">Hidden from readers. Visible to admins.</p>
                          </div>
                          <Switch
                            id="bookAnonymousToggle"
                            checked={draft.is_anonymous}
                            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_anonymous: checked }))}
                          />
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="bookHiddenToggle" className="font-ui text-sm font-medium cursor-pointer">{t("editor.hiddenPub")}</Label>
                            <p className="font-ui text-xs text-muted-foreground">{t("editor.hiddenDesc")}</p>
                          </div>
                          <Switch
                            id="bookHiddenToggle"
                            checked={draft.is_hidden}
                            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_hidden: checked }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cover image */}
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-foreground">{t("editor.coverImage")}</h3>
                        <p className="font-ui text-xs text-muted-foreground mt-0.5">{t("editor.coverVisible")} JPG, PNG, WEBP — მაქს. 5MB.</p>
                      </div>
                      <div className="flex flex-wrap items-start gap-5">
                        {currentCoverUrl ? (
                          <div className="group relative flex-shrink-0">
                            <img
                              src={currentCoverUrl}
                              alt="Cover preview"
                              className="h-40 w-32 rounded-xl border object-cover shadow-card"
                            />
                            <button
                              onClick={() => {
                                setCoverImage(null);
                                setCoverPreview(null);
                                if (coverInputRef.current) coverInputRef.current.value = "";
                                setCoverRevision((prev) => prev + 1);
                              }}
                              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-white shadow transition-all opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                              aria-label="Remove cover"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => coverInputRef.current?.click()}
                            className="flex h-40 w-32 flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary active:bg-muted/30"
                          >
                            <ImagePlus className="h-7 w-7" />
                            <span className="px-2 text-center font-ui text-xs leading-tight">{t("editor.addCover")}</span>
                          </button>
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
                                setCoverPreview(URL.createObjectURL(file));
                              } else {
                                setCoverPreview(null);
                              }
                              setCoverRevision((prev) => prev + 1);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => coverInputRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium font-ui transition-colors hover:border-primary/40 hover:text-primary w-fit"
                          >
                            <ImagePlus className="h-4 w-4" />
                            {currentCoverUrl ? "Change cover" : "Upload cover"}
                          </button>
                          {coverImage && (
                            <p className="font-ui text-xs text-muted-foreground">{t("editor.selected")} {coverImage.name}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mobile delete book button */}
                    <div className="sm:hidden pt-2 border-t border-border/40">
                      <Button
                        variant="destructive"
                        className="w-full h-11 gap-2 font-ui"
                        onClick={async () => {
                          if (await confirm({ title: t("editor.deleteBookConfirm"), destructive: true, confirmText: "Delete Book" })) {
                            try {
                              await deleteContentItem("books", bookId);
                              toast({ title: t("editor.bookDeleted") });
                              navigate("/writer/new");
                            } catch {
                              toast({ variant: "destructive", title: t("work.deleteFailed") });
                            }
                          }
                        }}
                      >
                        <Trash className="h-4 w-4" /> Delete Book
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── FOREWORD ─────────────────────────────────── */}
              {activeSection === "foreword" && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground">{t("editor.editForeword")}</h2>
                      <p className="mt-1 font-ui text-sm text-muted-foreground">Write an introduction to your book</p>
                    </div>
                    <Button
                      className="gap-2 h-10 hidden sm:inline-flex"
                      onClick={async () => {
                        try {
                          await autosave.saveNow();
                          toast({ title: t("editor.forewordSaved") });
                        } catch {
                          toast({ variant: "destructive", title: t("editor.saveFailed") });
                        }
                      }}
                      disabled={autosave.isSaving}
                    >
                      <Save className="h-4 w-4" /> Save
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-ui text-sm font-medium">{t("editor.forewordText")}</Label>
                    <RichTextEditor value={draft.foreword} onChange={(foreword) => setDraft(p => ({ ...p, foreword }))} minHeightClass="min-h-[320px] sm:min-h-[420px]" placeholder={t("editor.writeForeword")} />
                  </div>
                </div>
              )}

              {/* ── AFTERWORD ────────────────────────────────── */}
              {activeSection === "afterword" && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground">{t("editor.editAfterword")}</h2>
                      <p className="mt-1 font-ui text-sm text-muted-foreground">Write a closing note for your readers</p>
                    </div>
                    <Button
                      className="gap-2 h-10 hidden sm:inline-flex"
                      onClick={async () => {
                        try {
                          await autosave.saveNow();
                          toast({ title: t("editor.afterwordSaved") });
                        } catch {
                          toast({ variant: "destructive", title: t("editor.saveFailed") });
                        }
                      }}
                      disabled={autosave.isSaving}
                    >
                      <Save className="h-4 w-4" /> Save
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-ui text-sm font-medium">{t("editor.afterwordText")}</Label>
                    <RichTextEditor value={draft.afterword} onChange={(afterword) => setDraft(p => ({ ...p, afterword }))} minHeightClass="min-h-[320px] sm:min-h-[420px]" placeholder={t("editor.writeAfterword")} />
                  </div>
                </div>
              )}

              {/* ── CHAPTER ──────────────────────────────────── */}
              {typeof activeSection === "number" && (
                <ChapterEditorInline chapterId={activeSection} bookId={bookId} onDelete={() => setActiveSection("settings")} />
              )}

            </article>
          </main>
        </div>
      </div>

      {/* ─── Mobile sticky bottom save bar ──────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex sm:hidden items-center gap-3 border-t border-border/70 bg-background/95 backdrop-blur px-4 py-3 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]">
        <div className="flex-1 min-w-0">
          <p className="font-ui text-xs text-muted-foreground truncate">Editing</p>
          <p className="font-ui text-sm font-semibold text-foreground truncate">{activeSectionLabel}</p>
        </div>
        <Button
          className="gap-2 h-11 px-5 font-ui text-sm shrink-0"
          onClick={handleSave}
          disabled={autosave.isSaving}
        >
          <Save className="h-4 w-4" />
          {autosave.isSaving ? t("editor.saving") : t("editor.save")}
        </Button>
      </div>

    </div>
  );
};

export default WriterBookEditorPage;
