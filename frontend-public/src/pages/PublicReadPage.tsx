import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Calendar, Clock, Share2, ChevronLeft, ChevronRight,
  Menu, X, Type, BookOpen, MessageCircle, Minimize2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import EngagementPanel from "@/components/engagement/EngagementPanel";
import AnchoredCommentsDrawer from "@/components/engagement/AnchoredCommentsDrawer";
import FollowAuthorButton from "@/components/FollowAuthorButton";
import { Badge } from "@/components/ui/badge";
import ReadingFontSizeControl from "@/components/reader/ReadingFontSizeControl";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  fetchContentDetail, fetchMyContinueReading, resolveMediaUrl,
  saveReadingProgress, saveReadingProgressKeepalive,
  trackContentView, trackReferralVisit, buildFacebookShareIntent,
} from "@/lib/api";
import { authorProfilePath, resolveAuthorKey } from "@/lib/authors";
import {
  getStoredReadingFontSize, readingFontSizeClassByPreference,
  setStoredReadingFontSize, type ReadingFontSize,
} from "@/lib/fontSize";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { ContentCategory, ContentDetail } from "@/lib/types";
import { useReadChapters } from "@/hooks/useReadChapters";
import { useSession } from "@/hooks/useSession";

const allowedCategories: ContentCategory[] = ["books", "chapters", "poems", "stories"];

function stripHtml(value: string | undefined): string {
  return (value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hasTextContent(html?: string | null): boolean {
  if (!html) return false;
  return html.replace(/<[^>]+>/g, "").trim().length > 0;
}

function estimateReadTime(content: ContentDetail, template: string): string {
  const parts = [
    content.description, content.body, content.foreword, content.afterword,
    ...(content.chapters?.map((ch) => ch.body) || []),
  ];
  const words = stripHtml(parts.join(" ")).split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return template.replace("{minutes}", String(minutes));
}

/* ── Dispatch reading-focus events so Navbar can hide ── */
function dispatchFocusEvent(active: boolean) {
  window.dispatchEvent(new CustomEvent("reading-focus", { detail: { active } }));
}

/* ══════════════════════════════════════════════════════ */
const PublicReadPage = () => {
  const { t, language } = useI18n();
  const { me } = useSession();
  const { category: rawCategory, identifier: rawIdentifier, page: rawPage } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const identifier = (rawIdentifier || "").trim();
  const legacyPageParam = useMemo(() => new URLSearchParams(location.search).get("page"), [location.search]);

  const category = allowedCategories.includes(rawCategory as ContentCategory)
    ? (rawCategory as ContentCategory)
    : null;

  const { isRead, markAsRead } = useReadChapters();
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState<ReadingFontSize>(() => getStoredReadingFontSize());
  const [liveProgress, setLiveProgress] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedAnchor, setSelectedAnchor] = useState<{
    anchorType: "block" | "paragraph";
    anchorKey: string;
    paragraphIndex: number | null;
    previewText: string;
  } | null>(null);

  /* ── Immersive focus mode ── */
  const [focusMode, setFocusMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [autoFocusSuppressed, setAutoFocusSuppressed] = useState(false);

  const readingFontSizeClass = readingFontSizeClassByPreference[fontSize];
  const locale = language === "ka" ? "ka-GE" : "en-US";
  const readTimeTemplate = t("reader.readTime", "{minutes} min read");
  const categoryLabelByKey: Record<ContentCategory, string> = {
    books: t("category.book", "Book"),
    chapters: t("category.chapter", "Chapter"),
    poems: t("category.poem", "Poem"),
    stories: t("category.shortStory", "Short Story"),
  };

  const currentPage = useMemo(() => {
    if (category !== "books") return 1;
    if (!rawPage) return 0;
    const parsed = Number.parseInt(rawPage, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }, [category, rawPage]);

  const detailQuery = useQuery({
    queryKey: ["public-read", category, identifier],
    queryFn: () => fetchContentDetail(category as ContentCategory, identifier),
    enabled: Boolean(category) && Boolean(identifier),
  });

  const content = detailQuery.data;
  const continueReadingQuery = useQuery({
    queryKey: ["continue-reading-public-read", me?.id, category, content?.id, rawPage],
    queryFn: () => fetchMyContinueReading(30),
    enabled: Boolean(me && category && content?.id),
  });

  const canonicalIdentifier = (content?.public_slug || identifier).trim();
  const shareLink = useMemo(() => {
    if (!category || !canonicalIdentifier) return window.location.href;
    const base = `${window.location.origin}/read/${category}/${canonicalIdentifier}${currentPage > 0 ? `/${currentPage}` : ""}`;
    if (me?.username) return `${base}?ref=${encodeURIComponent(`@${me.username}`)}`;
    return base;
  }, [category, canonicalIdentifier, currentPage, me?.username]);

  const buildReadPath = useCallback((page: number) => {
    if (!category || !identifier) return "/browse";
    if (category !== "books" || page <= 0) return `/read/${category}/${canonicalIdentifier}`;
    return `/read/${category}/${canonicalIdentifier}/${page}`;
  }, [canonicalIdentifier, category, identifier]);

  const sections = useMemo(() => {
    if (!content || category !== "books") return [];
    const chapters = (content.chapters || []).slice().sort((a, b) => a.order - b.order);
    const s: { id: string; title: string; html: string }[] = [];

    if (hasTextContent(content.foreword)) {
      s.push({ id: "foreword", title: t("reader.foreword", "Foreword"), html: content.foreword! });
    }
    chapters.forEach((ch) => {
      s.push({
        id: `chapter-${ch.id}`,
        title: ch.title || t("reader.chapterUntitled", "Chapter {number}").replace("{number}", String(ch.auto_label || ch.order)),
        html: ch.body || `<p>${t("reader.chapterEmptyText", "This chapter has no text yet.")}</p>`,
      });
    });
    if (hasTextContent(content.afterword)) {
      s.push({ id: "afterword", title: t("reader.afterword", "Afterword"), html: content.afterword! });
    }
    return s;
  }, [content, category, t]);

  const commentTargetType = category === "chapters" ? "chapter" : "work";
  const commentTargetId = content?.id || 0;
  const commentWorkType = category === "books" || category === "stories" || category === "poems" ? category : undefined;
  const preferParagraphAnchorOnly = category !== "chapters" && content?.source_type === "upload";

  const currentChapterId = useMemo(() => {
    if (category !== "books" || currentPage <= 0) return null;
    const section = sections[currentPage - 1];
    if (!section || !section.id.startsWith("chapter-")) return null;
    const parsed = Number.parseInt(section.id.replace("chapter-", ""), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [category, currentPage, sections]);

  const lastChapterPage = useMemo(() => {
    if (category !== "books" || sections.length === 0) return null;
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      if (sections[i].id.startsWith("chapter-")) {
        return i + 1; // 1-based page index
      }
    }
    return null;
  }, [category, sections]);

  const afterwordPage = useMemo(() => {
    if (category !== "books" || sections.length === 0) return null;
    const index = sections.findIndex((section) => section.id === "afterword");
    return index >= 0 ? index + 1 : null; // 1-based page index
  }, [category, sections]);

  const endButtonPage = afterwordPage ?? lastChapterPage;

  const showEndButton = Boolean(
    category === "books" &&
    currentPage > 0 &&
    endButtonPage !== null &&
    currentPage === endButtonPage,
  );

  /* ── Per-chapter saved progress map ── */
  const chapterProgressMap = useMemo(() => {
    const items = continueReadingQuery.data || [];
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.chapter) {
        map.set(`chapter-${item.chapter.id}`, Number(item.progress_percent || 0));
      }
      map.set(`work-${item.work.id}`, Number(item.progress_percent || 0));
    }
    return map;
  }, [continueReadingQuery.data]);

  const savedProgress = useMemo(() => {
    if (!content?.id || !category) return 0;
    if (category === "chapters") {
      return chapterProgressMap.get(`chapter-${content.id}`) || 0;
    }
    if (category === "books" && currentChapterId) {
      const chapterProg = chapterProgressMap.get(`chapter-${currentChapterId}`);
      if (chapterProg !== undefined) return chapterProg;
    }
    return chapterProgressMap.get(`work-${content.id}`) || 0;
  }, [category, content?.id, chapterProgressMap, currentChapterId]);

  const displayProgress = Math.max(liveProgress, savedProgress);

  /* ── Mobile-only auto-enter focus mode when reading body fills viewport ── */
  useEffect(() => {
    if (!category) return;

    const isMobileViewport = () => window.matchMedia("(max-width: 1023px)").matches;

    const maybeAutoEnterFocus = () => {
      if (!isMobileViewport()) return;
      const readingBody = contentAreaRef.current?.querySelector<HTMLElement>("[data-reading-body=\"true\"]");
      if (!readingBody) {
        if (autoFocusSuppressed) setAutoFocusSuppressed(false);
        return;
      }

      const rect = readingBody.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const bodyFillsViewport = rect.top <= 0 && rect.bottom >= viewportHeight;

      if (!bodyFillsViewport) {
        if (autoFocusSuppressed) setAutoFocusSuppressed(false);
        return;
      }

      if (!focusMode && !autoFocusSuppressed) {
        setFocusMode(true);
      }
    };

    maybeAutoEnterFocus();
    window.addEventListener("scroll", maybeAutoEnterFocus, { passive: true });
    window.addEventListener("resize", maybeAutoEnterFocus);
    return () => {
      window.removeEventListener("scroll", maybeAutoEnterFocus);
      window.removeEventListener("resize", maybeAutoEnterFocus);
    };
  }, [autoFocusSuppressed, category, content?.id, currentPage, focusMode, sections.length]);

  // Dispatch focus event to hide Navbar
  useEffect(() => {
    dispatchFocusEvent(focusMode);
    return () => dispatchFocusEvent(false);
  }, [focusMode]);

  // Close drawer when focus exits
  useEffect(() => {
    if (!focusMode) setDrawerOpen(false);
  }, [focusMode]);

  useEffect(() => {
    if (currentPage > 0 && sections[currentPage - 1]) {
      const section = sections[currentPage - 1];
      if (section.id.startsWith("chapter-")) {
        const chapterId = parseInt(section.id.replace("chapter-", ""), 10);
        markAsRead(chapterId);
      }
    }
  }, [currentPage, sections, markAsRead]);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const ref = search.get("ref") || undefined;
    const refCode = search.get("ref_code") || undefined;
    if (!ref && !refCode) return;
    trackReferralVisit({ ref, ref_code: refCode }).catch(() => undefined);
  }, [location.search]);

  useEffect(() => {
    if (category !== "books" || !legacyPageParam) return;
    const parsed = Number.parseInt(legacyPageParam, 10);
    const legacyPage = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    const target = buildReadPath(legacyPage);
    if (`${location.pathname}${location.search}` !== target) {
      navigate(target, { replace: true });
    }
  }, [buildReadPath, category, legacyPageParam, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!category || !content?.public_slug || identifier === content.public_slug) return;
    const target = buildReadPath(currentPage);
    if (location.pathname !== target && !location.search) {
      navigate(target, { replace: true });
    }
  }, [buildReadPath, category, content?.public_slug, currentPage, identifier, location.pathname, location.search, navigate]);

  useEffect(() => {
    if ((rawPage || legacyPageParam) && !detailQuery.isLoading && detailQuery.data) {
      setTimeout(() => {
        contentAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 500);
    }
  }, [detailQuery.isLoading, detailQuery.data, rawPage, legacyPageParam]);

  /* ── Per-chapter SCROLL-BASED progress tracking ── */
  useEffect(() => {
    if (!content || !category) return;

    const computeProgressPercent = () => {
      // Always use scroll-based progress for all content types
      const doc = document.documentElement;
      const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
      return Math.max(0, Math.min(100, (window.scrollY / scrollable) * 100));
    };

    const buildProgressPayload = (progressPercent: number) => {
      if (category === "books") {
        return {
          work_id: content.id,
          work_type: "books" as const,
          chapter_id: currentChapterId,
          progress_percent: Number(progressPercent.toFixed(2)),
          last_position: {
            page: currentPage,
            chapter_id: currentChapterId,
            scroll_y: Math.round(window.scrollY),
            route: location.pathname,
          },
        };
      }
      if (category === "stories" || category === "poems") {
        return {
          work_id: content.id,
          work_type: category,
          progress_percent: Number(progressPercent.toFixed(2)),
          last_position: {
            scroll_y: Math.round(window.scrollY),
            route: location.pathname,
          },
        };
      }
      return {
        work_id: Number(content.book || 0),
        work_type: "books" as const,
        chapter_id: content.id,
        progress_percent: Number(progressPercent.toFixed(2)),
        last_position: {
          chapter_id: content.id,
          scroll_y: Math.round(window.scrollY),
          route: location.pathname,
        },
      };
    };

    trackContentView(category, canonicalIdentifier).catch(() => undefined);

    const sendProgress = () => {
      const progressPercent = computeProgressPercent();
      setLiveProgress(progressPercent);
      if (!me) return;
      const payload = buildProgressPayload(progressPercent);
      if (!payload.work_id) return;
      saveReadingProgress(payload).catch(() => undefined);
    };

    const handleBeforeUnload = () => {
      if (!me) return;
      const progressPercent = computeProgressPercent();
      const payload = buildProgressPayload(progressPercent);
      if (!payload.work_id) return;
      saveReadingProgressKeepalive(payload);
    };

    // Also track on scroll for real-time bar updates
    const handleScroll = () => {
      const progressPercent = computeProgressPercent();
      setLiveProgress(progressPercent);
    };

    sendProgress();
    const intervalId = window.setInterval(sendProgress, 15000);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("scroll", handleScroll);
      sendProgress();
    };
  }, [canonicalIdentifier, category, content, currentChapterId, currentPage, location.pathname, me, sections.length]);

  // Anchored comments block-id setup
  useEffect(() => {
    const root = contentAreaRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("p, h1, h2, h3, blockquote, li, div[data-block-id], div[id]"));
    let paragraphIndex = 0;
    for (const node of nodes) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      node.dataset.paragraphIndex = String(paragraphIndex);
      const existingBlockId = node.getAttribute("data-block-id") || node.getAttribute("id");
      if (!preferParagraphAnchorOnly) {
        node.setAttribute("data-block-id", existingBlockId || `p-${paragraphIndex}`);
      } else if (node.hasAttribute("data-block-id")) {
        node.removeAttribute("data-block-id");
      }
      paragraphIndex += 1;
    }
  }, [category, content?.id, currentPage, preferParagraphAnchorOnly, sections]);

  /* ── Early returns ── */
  if (!category || !identifier) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">{t("reader.invalidContentLink", "Content link is invalid.")}</h1>
        <Link to="/browse"><Button variant="outline" className="mt-4">{t("reader.backToLibrary", "Back to library")}</Button></Link>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-24 text-center text-sm text-muted-foreground">
        {t("common.loading", "Loading...")}
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">{t("reader.workNotFound", "Work not found.")}</h1>
        <Link to="/browse"><Button variant="outline" className="mt-4">{t("reader.backToLibrary", "Back to library")}</Button></Link>
      </div>
    );
  }

  const coverUrl = resolveMediaUrl(content.cover_image);
  const authorDisplay = content.author_name || content.author_username || t("workcard.anonymous", "anonymous");
  const authorPath = authorProfilePath(resolveAuthorKey(content));

  const navigateToPage = (p: number) => {
    navigate(buildReadPath(p));
    contentAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleReadingFontSizeChange = (next: ReadingFontSize) => {
    setStoredReadingFontSize(next);
    setFontSize(next);
  };

  const exitFocusMode = () => {
    setAutoFocusSuppressed(true);
    setFocusMode(false);
    setDrawerOpen(false);
  };

  const isReadingChapter = category === "books" && currentPage > 0;
  const isReadingContent = isReadingChapter || (category !== "books" && category !== null);

  return (
    <div>
      {/* ── Reading progress bar — always visible ── */}
      {displayProgress > 0 && (
        <div className="reading-progress" style={{ width: `${Math.max(1, Math.min(100, displayProgress))}%` }} />
      )}

      {/* ══════════ HERO SECTION ══════════ */}
      <AnimatePresence>
        {!focusMode && (
          <motion.div
            initial={{ opacity: 0, height: "auto" }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="relative border-b bg-background overflow-hidden min-h-[50vh] flex flex-col justify-center">
              {coverUrl && (
                <>
                  <div
                    className="absolute inset-0 opacity-20 bg-cover bg-center blur-2xl saturate-[1.2]"
                    style={{ backgroundImage: `url(${coverUrl})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/30" />
                </>
              )}

              <div className="container relative mx-auto px-6 py-8 md:py-16 z-10">
                <Link to="/browse">
                  <Button variant="outline" size="default" className="mb-6 gap-2 font-ui text-sm -ml-1 h-11 px-5 rounded-xl border-border/60 hover:bg-primary/5 hover:border-primary/40 transition-all bg-background/50 backdrop-blur-md">
                    <ArrowLeft className="h-4 w-4" /> {t("reader.backToLibrary", "Back to library")}
                  </Button>
                </Link>

                <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-center md:items-start text-center md:text-left">
                  {coverUrl && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-48 md:w-64 lg:w-72 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10"
                    >
                      <img src={coverUrl} alt="Cover" className="w-full h-auto object-cover aspect-[2/3]" />
                    </motion.div>
                  )}

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 pt-2 md:pt-4 w-full">
                    <div className="mb-4 flex items-center justify-center md:justify-start gap-2">
                      <Badge variant="secondary" className="font-ui text-xs bg-background/50 backdrop-blur-md border border-border/50">{categoryLabelByKey[category]}</Badge>
                    </div>

                    <h1 className="font-display text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl drop-shadow-sm">{content.title}</h1>

                    <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-3">
                      <p className="font-ui text-lg text-muted-foreground">
                        {t("workcard.by", "by ")}
                        <Link to={authorPath} className="font-medium text-foreground hover:text-primary hover:underline transition-colors">{authorDisplay}</Link>
                      </p>
                      <FollowAuthorButton authorId={content.author_id} />
                    </div>

                    {content.description && (
                      <div className="reader-html prose-literary mt-6 text-foreground/85 md:text-lg opacity-90 leading-relaxed md:max-w-3xl" dangerouslySetInnerHTML={{ __html: content.description }} />
                    )}

                    <div className="mt-8 flex flex-wrap items-center justify-center md:justify-start gap-3 font-ui text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5 bg-background/50 backdrop-blur-md px-3 py-1.5 rounded-md border border-border/50 shadow-sm">
                        <Clock className="h-3.5 w-3.5" /> {estimateReadTime(content, readTimeTemplate)}
                      </span>
                      <span className="flex items-center gap-1.5 bg-background/50 backdrop-blur-md px-3 py-1.5 rounded-md border border-border/50 shadow-sm">
                        <Calendar className="h-3.5 w-3.5" /> {new Date(content.created_at).toLocaleDateString(locale)}
                      </span>
                      <Button
                        variant="outline" size="sm"
                        onClick={async () => { await navigator.clipboard.writeText(shareLink); }}
                        className="bg-background/50 backdrop-blur-md hover:bg-background/80"
                      >
                        <Share2 className="h-3 w-3 mr-1" /> Copy Link
                      </Button>
                    </div>

                    {/* Start Reading Button */}
                    {(category !== "books" || currentPage === 0) && (
                      <div className="mt-8 md:mt-12 flex justify-center md:justify-start">
                        <Button
                          size="lg"
                          className="w-full sm:w-auto font-ui text-base h-14 px-12 rounded-xl shadow-warm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all text-white"
                          style={{ background: "var(--hero-gradient)", touchAction: "manipulation" }}
                          onClick={() => {
                            if (category === "books") {
                              setFocusMode(true);
                              navigateToPage(1);
                            } else {
                              setAutoFocusSuppressed(false);
                              setFocusMode(true);
                              contentAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }}
                        >
                          {t("reader.startReading", "Reading Mode")}
                        </Button>
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════ CONTENT AREA ══════════ */}
      <motion.article
        ref={contentAreaRef}
        onClick={(event) => {
          const targetElement = event.target as HTMLElement;
          if (targetElement.closest("button, a, input, textarea")) return;
          const block = targetElement.closest<HTMLElement>("[data-paragraph-index]");
          if (!block) return;
          const paragraphIndexRaw = block.dataset.paragraphIndex;
          const paragraphIndex = paragraphIndexRaw && !Number.isNaN(Number(paragraphIndexRaw)) ? Number(paragraphIndexRaw) : null;
          const blockId = preferParagraphAnchorOnly ? "" : (block.dataset.blockId || "");
          const previewText = (block.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180);
          setSelectedAnchor({
            anchorType: blockId ? "block" : "paragraph",
            anchorKey: blockId || (paragraphIndex !== null ? `p:${paragraphIndex}` : "p:0"),
            paragraphIndex,
            previewText,
          });
          setCommentsOpen(true);
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={cn("container mx-auto px-4 sm:px-6 py-8 scroll-mt-20", focusMode && "pt-4")}
      >
        <div className={cn("mx-auto w-full md:w-[95%] lg:w-[75%]", readingFontSizeClass)}>

          {/* Non-focus-mode controls */}
          {!focusMode && (
            <>
              {isReadingContent && (
                <div className="mb-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAutoFocusSuppressed(false);
                      setFocusMode(true);
                    }}
                    className="font-ui rounded-xl"
                    style={{ touchAction: "manipulation" }}
                  >
                    {t("reader.startReading", "Reading Mode")}
                  </Button>
                </div>
              )}
              <div className="mb-6 h-1.5 w-16 rounded-full bg-primary" />
              <ReadingFontSizeControl value={fontSize} onChange={handleReadingFontSizeChange} />
            </>
          )}

          {content.upload_file && (
            <p className="mb-6 text-sm text-muted-foreground">
              {t("reader.uploadedFile", "Uploaded file:")}{" "}
              <a className="underline" href={content.upload_file} target="_blank" rel="noreferrer">{t("reader.openFile", "Open file")}</a>
            </p>
          )}

          {/* ── Book content ── */}
          {category === "books" ? (
            <div className="space-y-8">
              {sections.length > 0 ? (
                currentPage === 0 ? (
                  /* ──── TABLE OF CONTENTS with per-chapter progress ──── */
                  <section className="animate-in fade-in duration-500">
                    <h2 className="font-display text-3xl font-semibold text-foreground mb-6">{t("reader.contents", "Contents")}</h2>
                    <div className="flex flex-col gap-3">
                      {sections.map((sec, idx) => {
                        const isChapter = sec.id.startsWith("chapter-");
                        const chapterId = isChapter ? parseInt(sec.id.replace("chapter-", ""), 10) : null;
                        const showNew = isChapter && chapterId !== null && !isRead(chapterId);

                        return (
                          <button
                            key={sec.id}
                            onClick={() => navigateToPage(idx + 1)}
                            style={{ touchAction: "manipulation" }}
                            className="text-left flex justify-between items-center font-ui text-base sm:text-lg text-foreground hover:text-primary transition-colors border border-border/50 bg-background/50 rounded-xl p-4 group"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-muted-foreground text-sm">{idx + 1}.</span>
                              <span className="truncate">{sec.title}</span>
                            </span>
                            {showNew && (
                              <span className="flex-shrink-0 ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-blue-500/20 text-blue-500">
                                {t("reader.new", "New")}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : sections[currentPage - 1] ? (
                  /* ──── CHAPTER CONTENT ──── */
                  <section className="animate-in fade-in duration-500" data-reading-body="true" key={currentPage}>
                    {/* Minimal inline chapter title in focus mode */}
                    {focusMode && (
                      <p className="font-ui text-xs text-muted-foreground mb-1 tracking-wide uppercase">{content.title}</p>
                    )}
                    <h2 className="font-display text-2xl sm:text-3xl font-semibold text-foreground mb-6">{sections[currentPage - 1].title}</h2>
                    <div
                      className="reader-html prose-literary text-foreground/90"
                      dangerouslySetInnerHTML={{ __html: sections[currentPage - 1].html }}
                    />
                  </section>
                ) : (
                  <p className="font-ui text-sm text-muted-foreground">{t("reader.pageNotFound", "Page not found.")}</p>
                )
              ) : content.extracted_text ? (
                <section data-reading-body="true">
                  <h2 className="font-display text-2xl font-semibold text-foreground">{t("reader.uploadedText", "Uploaded text")}</h2>
                  <pre className="prose-literary mt-3 whitespace-pre-wrap text-foreground/90">{content.extracted_text}</pre>
                </section>
              ) : (
                <p className="font-ui text-sm text-muted-foreground">{t("reader.noReadableText", "Readable text is not available.")}</p>
              )}
            </div>
          ) : content.body ? (
            <div data-reading-body="true" className="reader-html prose-literary text-foreground/90" dangerouslySetInnerHTML={{ __html: content.body }} />
          ) : content.extracted_text ? (
            <pre data-reading-body="true" className="prose-literary whitespace-pre-wrap text-foreground/90">{content.extracted_text}</pre>
          ) : (
            <p className="font-ui text-sm text-muted-foreground">{t("reader.noReadableText", "Readable text is not available.")}</p>
          )}

          {/* ── Chapter navigation — only shown outside focus mode OR inline at bottom ── */}
          {category === "books" && sections.length > 0 && currentPage > 0 && (
            <div className="mt-12 flex items-center justify-between gap-4">
              <Button
                variant="outline"
                onClick={() => navigateToPage(Math.max(0, currentPage - 1))}
                className="gap-2 font-ui h-12 px-6 rounded-xl border-border/60 hover:bg-primary/5 hover:border-primary/40 transition-all"
                style={{ touchAction: "manipulation" }}
              >
                <ChevronLeft className="h-4 w-4" />
                {currentPage === 1 ? t("reader.contents", "Contents") : t("reader.previous", "Previous")}
              </Button>
              <div className="ml-auto flex items-center gap-2">
                {showEndButton && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigateToPage(0);
                      setFocusMode(false);
                    }}
                    className="gap-2 font-ui h-12 px-6 rounded-xl border-primary/40 text-primary hover:bg-primary/10"
                    style={{ touchAction: "manipulation" }}
                  >
                    {t("reader.end", "End")}
                  </Button>
                )}
                {currentPage < sections.length && (
                  <Button
                    onClick={() => navigateToPage(currentPage + 1)}
                    className="gap-2 font-ui h-12 px-6 rounded-xl shadow-warm hover:shadow-lg transition-all"
                    style={{ touchAction: "manipulation" }}
                  >
                    {t("reader.next", "Next")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Engagement + footer — hidden in focus mode ── */}
          {!focusMode && (
            <>
              <Separator className="my-12" />
              <div className="text-center pb-4">
                <Link to="/browse">
                  <Button variant="outline" className="gap-2 font-ui h-11 px-6 rounded-xl border-border/60 hover:bg-primary/5">
                    <ArrowLeft className="h-4 w-4" /> {t("reader.backToLibrary", "Back to library")}
                  </Button>
                </Link>
              </div>
              <EngagementPanel category={category} identifier={canonicalIdentifier} className="mt-8" />
            </>
          )}
        </div>
      </motion.article>

      {/* ══════════ IMMERSIVE FAB + DRAWER ══════════ */}
      <AnimatePresence>
        {focusMode && (
          <>
            {/* FAB — toggles the drawer */}
            {!drawerOpen && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={() => setDrawerOpen(true)}
                className="fixed bottom-6 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg border border-border/40"
                style={{ background: "hsl(var(--card) / 0.95)", backdropFilter: "blur(12px)", touchAction: "manipulation" }}
                aria-label="Open reading menu"
              >
                <Menu className="h-5 w-5 text-foreground" />
              </motion.button>
            )}

            {/* Drawer backdrop */}
            {drawerOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/30"
                onClick={() => setDrawerOpen(false)}
              />
            )}

            {/* Drawer panel */}
            <AnimatePresence>
              {drawerOpen && (
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border/40 shadow-2xl overflow-hidden md:bottom-4 md:left-auto md:right-4 md:w-[30rem] lg:w-[34rem] md:rounded-2xl md:border"
                  style={{ background: "hsl(var(--card))", paddingBottom: "env(safe-area-inset-bottom)" }}
                >
                  {/* Drawer handle */}
                  <div className="flex justify-center py-2">
                    <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                  </div>

                  <div className="px-5 pb-5 pt-1 space-y-4 max-h-[70vh] overflow-y-auto md:max-h-[78vh] md:px-5 md:pb-5 md:space-y-4">
                    {/* Title + Close */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-semibold text-foreground">{t("reader.readingMenu", "Reading Menu")}</h3>
                      <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" style={{ touchAction: "manipulation" }}>
                        <X className="h-5 w-5 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Progress indicator */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-ui text-xs text-muted-foreground">{t("reader.chapterProgress", "Chapter progress")}</span>
                        <span className="font-ui text-xs font-semibold text-foreground">{displayProgress.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, displayProgress)}%`, background: "var(--hero-gradient)" }} />
                      </div>
                    </div>

                    {/* Font size */}
                    <ReadingFontSizeControl value={fontSize} onChange={handleReadingFontSizeChange} className="!mb-0 !mt-0" />

                    {/* Chapter navigation */}
                    {category === "books" && sections.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1}
                          onClick={() => { navigateToPage(Math.max(1, currentPage - 1)); setDrawerOpen(false); }}
                          className="flex-1 gap-1 h-10 rounded-xl"
                          style={{ touchAction: "manipulation" }}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" /> {t("reader.prev", "Prev")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { navigateToPage(0); setDrawerOpen(false); exitFocusMode(); }}
                          className="gap-1 h-10 rounded-xl px-3"
                          style={{ touchAction: "manipulation" }}
                        >
                          <BookOpen className="h-3.5 w-3.5" /> {t("reader.toc", "TOC")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= sections.length}
                          onClick={() => { navigateToPage(currentPage + 1); setDrawerOpen(false); }}
                          className="flex-1 gap-1 h-10 rounded-xl"
                          style={{ touchAction: "manipulation" }}
                        >
                          {t("reader.next", "Next")} <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                        {showEndButton && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { navigateToPage(0); setDrawerOpen(false); exitFocusMode(); }}
                            className="w-full gap-1 h-10 rounded-xl border-primary/40 text-primary hover:bg-primary/10"
                            style={{ touchAction: "manipulation" }}
                          >
                            {t("reader.end", "End")}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Actions row */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={async () => { await navigator.clipboard.writeText(shareLink); }}
                        className="gap-1.5 h-10 rounded-xl flex-1"
                        style={{ touchAction: "manipulation" }}
                      >
                        <Share2 className="h-3.5 w-3.5" /> {t("reader.share", "Share")}
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => { setCommentsOpen(true); setDrawerOpen(false); }}
                        className="gap-1.5 h-10 rounded-xl flex-1"
                        style={{ touchAction: "manipulation" }}
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> {t("reader.comments", "Comments")}
                      </Button>
                    </div>

                    {/* Exit focus mode */}
                    <Button
                      variant="ghost"
                      onClick={exitFocusMode}
                      className="w-full gap-2 h-10 rounded-xl text-muted-foreground hover:text-foreground"
                      style={{ touchAction: "manipulation" }}
                    >
                      <Minimize2 className="h-4 w-4" /> {t("reader.exitFocus", "Exit Focus Mode")}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>

      <AnchoredCommentsDrawer
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        targetType={commentTargetType}
        targetId={commentTargetId}
        workType={commentWorkType}
        anchor={selectedAnchor}
      />
    </div>
  );
};

export default PublicReadPage;
