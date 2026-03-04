import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  FileText,
  Feather,
  Plus,
  Save,
  Trash2,
  Image as ImageIcon,
  Upload,
  GripVertical,
  ChevronRight,
  ChevronDown,
  Settings,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Quote,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link2,
  Minus,
  Eye,
  EyeOff,
  Menu,
  X,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ContentType = "novel" | "story" | "poem";
type Step = "create" | "editor";

interface Chapter {
  id: string;
  title: string;
  order: number;
  content: string;
  status: "draft" | "ready";
}

const SubmitPage = () => {
  const isMobile = useIsMobile();
  const [step, setStep] = useState<Step>("create");
  const [contentType, setContentType] = useState<ContentType>("novel");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Editor state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chapterNumeration, setChapterNumeration] = useState("numbered");
  const [coverFile, setCoverFile] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"overview" | string>("overview");
  const [chapters, setChapters] = useState<Chapter[]>([
    { id: "ch-1", title: "Chapter 1", order: 1, content: "", status: "draft" },
  ]);
  const [allowComments, setAllowComments] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const handleCreate = () => {
    setStep("editor");
    setSavedAt(new Date().toLocaleTimeString());
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Please add a title before saving");
      return;
    }
    setSavedAt(new Date().toLocaleTimeString());
    toast.success("Draft saved successfully");
  };

  const handleAddChapter = () => {
    const newOrder = chapters.length + 1;
    const newChapter: Chapter = {
      id: `ch-${Date.now()}`,
      title: `Chapter ${newOrder}`,
      order: newOrder,
      content: "",
      status: "draft",
    };
    setChapters([...chapters, newChapter]);
    setActiveView(newChapter.id);
    toast.success("Chapter added");
  };

  const handleDeleteChapter = (id: string) => {
    if (chapters.length <= 1) {
      toast.error("You need at least one chapter");
      return;
    }
    setChapters(chapters.filter((c) => c.id !== id));
    setActiveView("overview");
    toast.success("Chapter removed");
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error("Please upload JPG, PNG or WEBP");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Cover must be under 5MB");
        return;
      }
      const url = URL.createObjectURL(file);
      setCoverFile(url);
      toast.success("Cover uploaded");
    }
  };

  const updateChapter = (id: string, updates: Partial<Chapter>) => {
    setChapters(chapters.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const activeChapter = chapters.find((c) => c.id === activeView);

  const contentTypeInfo: Record<ContentType, { icon: React.ReactNode; label: string; desc: string }> = {
    novel: { icon: <BookOpen className="h-5 w-5 text-primary" />, label: "Novel / Book", desc: "Long-form work with chapter outline" },
    story: { icon: <FileText className="h-5 w-5 text-primary" />, label: "Short Story", desc: "Single narrative without chapters" },
    poem: { icon: <Feather className="h-5 w-5 text-primary" />, label: "Poetry", desc: "Verse, stanza-based work" },
  };

  // ─── Step 1: Creation Wizard ───
  if (step === "create") {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl"
        >
          <div className="rounded-xl border border-border bg-card p-5 sm:p-8 shadow-card">
            <Badge variant="secondary" className="mb-4 font-ui text-xs">
              <Feather className="mr-1.5 h-3 w-3" />
              Author's Workspace
            </Badge>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Create New Work
            </h1>
            <p className="mt-2 font-body text-muted-foreground">
              Pick content type and source type. We will create your draft and open it immediately.
            </p>

            <div className="mt-8 space-y-6">
              {/* Content Type */}
              <div className="space-y-2">
                <Label className="font-ui font-semibold">Content Type</Label>
                <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
                  <SelectTrigger className="font-ui h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novel">Novel / Book</SelectItem>
                    <SelectItem value="story">Short Story</SelectItem>
                    <SelectItem value="poem">Poetry</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Source Type */}
              <div className="space-y-2">
                <Label className="font-ui font-semibold">Source Type</Label>
                <Select defaultValue="manual">
                  <SelectTrigger className="font-ui h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Write manually</SelectItem>
                    <SelectItem value="pdf">Upload PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Anonymous Toggle */}
              <div className="flex items-start justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div className="space-y-1">
                  <p className="font-ui text-sm font-medium text-foreground">Publish anonymously</p>
                  <p className="font-ui text-xs text-muted-foreground">
                    Public readers and redactors will see &quot;Anonymous&quot;. Your identity is only visible to admins.
                  </p>
                </div>
                <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
              </div>

              {/* Content type preview */}
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                {contentTypeInfo[contentType].icon}
                <div>
                  <p className="font-ui text-sm font-semibold text-foreground">{contentTypeInfo[contentType].label}</p>
                  <p className="font-ui text-xs text-muted-foreground">{contentTypeInfo[contentType].desc}</p>
                </div>
              </div>

              <Button onClick={handleCreate} size="lg" className="w-full gap-2 text-base h-12">
                Create and Open Editor
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Step 2: Editor ───
  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* Header */}
        <div className="mb-4 sm:mb-6 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {/* Mobile sidebar toggle */}
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                >
                  {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
              )}
              <div>
                <Badge variant="secondary" className="mb-2 font-ui text-xs">
                  <BookOpen className="mr-1.5 h-3 w-3" />
                  Book Editor
                </Badge>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                  {title || "Untitled Work"}
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="font-ui text-xs">draft</Badge>
                  {savedAt && (
                    <span className="font-ui text-xs text-muted-foreground">
                      Saved at {savedAt}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button onClick={handleSave} size={isMobile ? "sm" : "default"} className="gap-2">
                <Save className="h-4 w-4" />
                Save
              </Button>
              <Button variant="destructive" size="icon" className={isMobile ? "h-9 w-9" : ""}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile sidebar drawer */}
        {isMobile && (
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-4 overflow-hidden"
              >
                <div className="rounded-xl border border-border bg-card p-4 shadow-card">
                  <p className="mb-3 font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contents
                  </p>
                  <button
                    onClick={() => { setActiveView("overview"); setSidebarOpen(false); }}
                    className={cn(
                      "mb-1 w-full rounded-lg px-3 py-2.5 text-left font-ui text-sm transition-colors",
                      activeView === "overview"
                        ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Overview & Settings
                    </div>
                  </button>
                  <Separator className="my-3" />
                  {contentType === "novel" && (
                    <>
                      <div className="space-y-1">
                        {chapters.map((ch) => (
                          <button
                            key={ch.id}
                            onClick={() => { setActiveView(ch.id); setSidebarOpen(false); }}
                            className={cn(
                              "w-full rounded-lg px-3 py-2.5 text-left font-ui text-sm transition-colors",
                              activeView === ch.id
                                ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                                : "text-foreground hover:bg-muted"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{ch.title}</span>
                              <Badge variant="outline" className="ml-2 text-[10px] font-normal shrink-0">
                                {ch.status}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleAddChapter}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2.5 font-ui text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Chapter
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Main Layout */}
        <div className="flex gap-6">
          {/* Desktop Sidebar */}
          {!isMobile && (
          <div className="w-56 shrink-0">
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              <p className="mb-3 font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contents
              </p>

              {/* Overview */}
              <button
                onClick={() => setActiveView("overview")}
                className={cn(
                  "mb-1 w-full rounded-lg px-3 py-2.5 text-left font-ui text-sm transition-colors",
                  activeView === "overview"
                    ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Overview & Settings
                </div>
              </button>

              <Separator className="my-3" />

              {/* Chapters */}
              {contentType === "novel" && (
                <>
                  <div className="space-y-1">
                    {chapters.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => setActiveView(ch.id)}
                        className={cn(
                          "w-full rounded-lg px-3 py-2.5 text-left font-ui text-sm transition-colors",
                          activeView === ch.id
                            ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{ch.title}</span>
                          <Badge variant="outline" className="ml-2 text-[10px] font-normal shrink-0">
                            {ch.status}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleAddChapter}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2.5 font-ui text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Chapter
                  </button>
                </>
              )}

              <Separator className="my-3" />

              {/* Recommendations link */}
              <button className="w-full rounded-lg px-3 py-2.5 text-left font-ui text-sm text-muted-foreground hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Recommendations
                  <span className="font-ui text-[10px]">(coming soon)</span>
                </div>
              </button>
            </div>
          </div>
          )}

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              {activeView === "overview" ? (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  {/* Title & Category */}
                  <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-card">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="font-ui font-semibold">Title</Label>
                        <Input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Your untitled work"
                          className="font-ui h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-ui font-semibold">Chapter Numeration</Label>
                        <Select value={chapterNumeration} onValueChange={setChapterNumeration}>
                          <SelectTrigger className="font-ui h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="numbered">Numbered (1, 2, 3…)</SelectItem>
                            <SelectItem value="roman">Roman (I, II, III…)</SelectItem>
                            <SelectItem value="custom">Custom titles</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-6 space-y-2">
                      <Label className="font-ui font-semibold">Book Description</Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Write a brief textual description..."
                        rows={4}
                        className="font-body"
                      />
                    </div>

                    {contentType === "novel" && (
                      <button
                        onClick={handleAddChapter}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 font-ui text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        <Plus className="h-4 w-4" />
                        Add Section To Book
                      </button>
                    )}
                  </div>

                  {/* Settings */}
                  <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-card">
                    <Label className="font-ui font-semibold text-base">Publishing Settings</Label>
                    <Select defaultValue="redactor">
                      <SelectTrigger className="mt-3 font-ui h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="redactor">Submit to redactor for review</SelectItem>
                        <SelectItem value="direct">Request direct publishing</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="flex items-start justify-between rounded-lg border border-border p-4">
                        <div className="space-y-1 pr-3">
                          <p className="font-ui text-sm font-medium">Publish anonymously</p>
                          <p className="font-ui text-xs text-muted-foreground">Hidden from readers. Visible to admins.</p>
                        </div>
                        <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                      </div>
                      <div className="flex items-start justify-between rounded-lg border border-border p-4">
                        <div className="space-y-1 pr-3">
                          <p className="font-ui text-sm font-medium">Allow comments</p>
                          <p className="font-ui text-xs text-muted-foreground">Readers can leave feedback on your work and individual chapters.</p>
                        </div>
                        <Switch checked={allowComments} onCheckedChange={setAllowComments} />
                      </div>
                    </div>
                  </div>

                  {/* Cover Upload */}
                  <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-card">
                    <Label className="font-ui font-semibold text-base">Cover Image</Label>
                    <p className="mt-1 font-ui text-xs text-muted-foreground">
                      Accepted formats: JPG, PNG, WEBP — max 5MB.
                    </p>
                    <div className="mt-4 flex items-start gap-6">
                      <div className="flex h-40 w-28 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden">
                        {coverFile ? (
                          <img src={coverFile} alt="Cover" className="h-full w-full object-cover" />
                        ) : (
                          <div className="text-center">
                            <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
                            <p className="mt-1 font-ui text-[10px] text-muted-foreground">Cover preview</p>
                          </div>
                        )}
                      </div>
                      <label className="cursor-pointer">
                        <Button variant="outline" className="gap-2 pointer-events-none">
                          <Upload className="h-4 w-4" />
                          Upload cover
                        </Button>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp"
                          className="hidden"
                          onChange={handleCoverUpload}
                        />
                      </label>
                    </div>
                  </div>
                </motion.div>
              ) : activeChapter ? (
                <motion.div
                  key={activeChapter.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="rounded-xl border border-border bg-card shadow-card"
                >
                  {/* Chapter Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
                    <div>
                      <h2 className="font-display text-xl font-bold text-foreground">
                        {activeChapter.title}
                      </h2>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className="font-ui text-xs">{activeChapter.status}</Badge>
                        {savedAt && (
                          <span className="font-ui text-xs text-muted-foreground">Saved at {savedAt}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleSave} className="gap-1.5">
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteChapter(activeChapter.id)}
                        className="gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Chapter Info */}
                  <div className="grid gap-4 border-b border-border p-4 sm:p-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="font-ui text-xs font-semibold text-muted-foreground">Title (auto-generated)</Label>
                      <Input
                        value={activeChapter.title}
                        onChange={(e) => updateChapter(activeChapter.id, { title: e.target.value })}
                        className="font-ui"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-ui text-xs font-semibold text-muted-foreground">Order</Label>
                      <Input
                        type="number"
                        value={activeChapter.order}
                        onChange={(e) => updateChapter(activeChapter.id, { order: parseInt(e.target.value) || 1 })}
                        className="font-ui"
                      />
                    </div>
                  </div>

                  {/* Rich Text Toolbar */}
                  <div className="border-b border-border px-4 sm:px-5 py-3 overflow-x-auto">
                    <Label className="mb-2 block font-ui text-xs font-semibold text-muted-foreground">Chapter Text</Label>
                    <div className="flex items-center gap-1 min-w-max">
                      {/* Font controls */}
                      <Select defaultValue="serif">
                        <SelectTrigger className="h-8 w-24 font-ui text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="serif">Serif</SelectItem>
                          <SelectItem value="sans">Sans-serif</SelectItem>
                          <SelectItem value="mono">Monospace</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select defaultValue="normal">
                        <SelectTrigger className="h-8 w-24 font-ui text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="h1">Heading 1</SelectItem>
                          <SelectItem value="h2">Heading 2</SelectItem>
                          <SelectItem value="h3">Heading 3</SelectItem>
                        </SelectContent>
                      </Select>

                      <Separator orientation="vertical" className="mx-1 h-6" />

                      {[Bold, Italic, Underline, Strikethrough].map((Icon, i) => (
                        <button
                          key={i}
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}

                      <Separator orientation="vertical" className="mx-1 h-6" />

                      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                        <Quote className="h-4 w-4" />
                      </button>
                      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                        <Minus className="h-4 w-4" />
                      </button>
                      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                        <List className="h-4 w-4" />
                      </button>
                      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                        <ListOrdered className="h-4 w-4" />
                      </button>

                      <Separator orientation="vertical" className="mx-1 h-6" />

                      {[AlignLeft, AlignCenter, AlignRight, AlignJustify].map((Icon, i) => (
                        <button
                          key={i}
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}

                      <Separator orientation="vertical" className="mx-1 h-6" />

                      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                        <Link2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Text Area */}
                  <div className="p-4 sm:p-5">
                    <Textarea
                      value={activeChapter.content}
                      onChange={(e) => updateChapter(activeChapter.id, { content: e.target.value })}
                      placeholder="Write chapter text..."
                      rows={isMobile ? 10 : 16}
                      className="resize-y border-none bg-transparent font-body text-base leading-relaxed shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* Footer */}
                  <div className="border-t border-border px-4 sm:px-5 py-3 hidden sm:block">
                    <p className="font-ui text-xs text-muted-foreground">
                      Shortcuts: Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+U
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SubmitPage;
