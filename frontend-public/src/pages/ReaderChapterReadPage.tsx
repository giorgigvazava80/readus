import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Share2, Menu, X, BookOpen, Minimize2, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import EngagementPanel from "@/components/engagement/EngagementPanel";
import ReadingFontSizeControl from "@/components/reader/ReadingFontSizeControl";
import { Button } from "@/components/ui/button";
import { fetchContentDetail, fetchMyContinueReading, saveReadingProgress, saveReadingProgressKeepalive, trackContentView } from "@/lib/api";
import { getStoredReadingFontSize, readingFontSizeClassByPreference, setStoredReadingFontSize, type ReadingFontSize } from "@/lib/fontSize";
import { cn } from "@/lib/utils";
import { useReadChapters } from "@/hooks/useReadChapters";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/useSession";

function dispatchFocusEvent(active: boolean) {
  window.dispatchEvent(new CustomEvent("reading-focus", { detail: { active } }));
}

const ReaderChapterReadPage = () => {
  const { t } = useI18n();
  const { identifier, chapterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const bookIdentifier = (identifier || "").trim();
  const currentChapterId = Number(chapterId);
  const { markAsRead } = useReadChapters();
  const { me } = useSession();
  const [fontSize, setFontSize] = useState<ReadingFontSize>(() => getStoredReadingFontSize());
  const [liveProgress, setLiveProgress] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [autoFocusSuppressed, setAutoFocusSuppressed] = useState(false);
  const chapterBodyRef = useRef<HTMLElement>(null);
  const readingFontSizeClass = readingFontSizeClassByPreference[fontSize];

  const bookQuery = useQuery({
    queryKey: ["reader", "book", bookIdentifier, "chapter", currentChapterId],
    queryFn: () => fetchContentDetail("books", bookIdentifier),
    enabled: Boolean(bookIdentifier) && Number.isFinite(currentChapterId),
  });

  const book = bookQuery.data;
  const chapters = useMemo(() => (book?.chapters || []).slice().sort((a, b) => a.order - b.order), [book]);
  const currentIndex = useMemo(() => chapters.findIndex((ch) => ch.id === currentChapterId), [chapters, currentChapterId]);
  const chapter = currentIndex >= 0 ? chapters[currentIndex] : null;

  const continueReadingQuery = useQuery({
    queryKey: ["continue-reading-chapter", me?.id, book?.id, chapter?.id],
    queryFn: () => fetchMyContinueReading(30),
    enabled: Boolean(me && book?.id && chapter?.id),
  });
  const savedProgress = useMemo(() => {
    if (!book?.id || !chapter?.id) return 0;
    const match = (continueReadingQuery.data || []).find(
      (item) => item.work.id === book.id && item.chapter?.id === chapter.id,
    );
    return Number(match?.progress_percent || 0);
  }, [book?.id, chapter?.id, continueReadingQuery.data]);
  const displayProgress = Math.max(liveProgress, savedProgress);

  const shareLink = useMemo(() => {
    if (!book || !chapter) return window.location.href;
    const base = `${window.location.origin}/read/chapters/${chapter.id}`;
    if (me?.username) return `${base}?ref=${encodeURIComponent(`@${me.username}`)}`;
    return base;
  }, [book, chapter, me?.username]);

  // Dispatch focus event
  useEffect(() => {
    dispatchFocusEvent(focusMode);
    return () => dispatchFocusEvent(false);
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) setDrawerOpen(false);
  }, [focusMode]);

  useEffect(() => {
    if (chapter) markAsRead(chapter.id);
  }, [chapter, markAsRead]);

  useEffect(() => {
    const isMobileViewport = () => window.matchMedia("(max-width: 1023px)").matches;

    const maybeAutoEnterFocus = () => {
      if (!chapter || !isMobileViewport()) return;
      const readingBody = chapterBodyRef.current;
      if (!readingBody) return;

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
  }, [autoFocusSuppressed, chapter, focusMode]);

  useEffect(() => {
    if (!book?.public_slug || bookIdentifier === book.public_slug || !Number.isFinite(currentChapterId)) return;
    const target = `/books/${book.public_slug}/chapters/${currentChapterId}`;
    if (location.pathname !== target) navigate(target, { replace: true });
  }, [book?.public_slug, bookIdentifier, currentChapterId, location.pathname, navigate]);

  // Scroll-based progress tracking
  useEffect(() => {
    if (!chapter || !book) return;

    const computeProgressPercent = () => {
      const doc = document.documentElement;
      const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
      return Math.max(0, Math.min(100, (window.scrollY / scrollable) * 100));
    };

    trackContentView("chapters", chapter.id).catch(() => undefined);

    const sendProgress = () => {
      const progressPercent = computeProgressPercent();
      setLiveProgress(progressPercent);
      if (!me) return;
      saveReadingProgress({
        work_id: book.id,
        work_type: "books",
        chapter_id: chapter.id,
        progress_percent: Number(progressPercent.toFixed(2)),
        last_position: {
          scroll_y: Math.round(window.scrollY),
          route: location.pathname,
          chapter_id: chapter.id,
        },
      }).catch(() => undefined);
    };

    const handleBeforeUnload = () => {
      if (!me) return;
      const progressPercent = computeProgressPercent();
      saveReadingProgressKeepalive({
        work_id: book.id,
        work_type: "books",
        chapter_id: chapter.id,
        progress_percent: Number(progressPercent.toFixed(2)),
        last_position: {
          scroll_y: Math.round(window.scrollY),
          route: location.pathname,
          chapter_id: chapter.id,
        },
      });
    };

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
  }, [book, chapter, location.pathname, me]);

  const handleReadingFontSizeChange = (next: ReadingFontSize) => {
    setStoredReadingFontSize(next);
    setFontSize(next);
  };

  const exitFocusMode = () => {
    setAutoFocusSuppressed(true);
    setFocusMode(false);
    setDrawerOpen(false);
  };

  if (!bookIdentifier || !Number.isFinite(currentChapterId)) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("reader.chapterInvalidLink", "Chapter link is invalid.")}</p>
      </div>
    );
  }

  if (bookQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("reader.chapterLoading", "Loading chapter...")}</p>
      </div>
    );
  }

  if (bookQuery.isError || !book) {
    return (
      <div className="container mx-auto px-6 py-10 space-y-4">
        <p className="font-ui text-sm text-red-700">{t("reader.chapterLoadError", "Could not load chapter.")}</p>
        <Link to="/books"><Button variant="outline">{t("reader.backToBooks", "Back to books")}</Button></Link>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="container mx-auto px-6 py-10 space-y-4">
        <p className="font-ui text-sm text-red-700">{t("reader.chapterNotFound", "This chapter was not found in the book.")}</p>
        <Link to={`/books/${book.public_slug || bookIdentifier}`}>
          <Button variant="outline">{t("reader.backToContents", "Back to contents")}</Button>
        </Link>
      </div>
    );
  }

  const canonicalBookIdentifier = (book.public_slug || bookIdentifier).trim();
  const previousChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
  const isLastChapter = !nextChapter;

  return (
    <div>
      {/* ── Reading progress bar — always visible ── */}
      {displayProgress > 0 && (
        <div className="reading-progress" style={{ width: `${Math.max(1, Math.min(100, displayProgress))}%` }} />
      )}

      <div className={cn("container mx-auto w-full md:w-[85%] lg:w-[70%] xl:w-[60%] space-y-6 md:space-y-10 px-4 py-6 md:px-8 md:py-12", focusMode && "pt-4")}>

        {/* ── Header — hidden in focus mode ── */}
        {!focusMode && (
          <section className="pb-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <Link to={`/books/${canonicalBookIdentifier}`}>
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground md:bg-secondary/50">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <p className="font-ui text-xs md:text-sm uppercase tracking-wider text-muted-foreground truncate">{book.title}</p>
                <h1 className="font-display text-2xl md:text-4xl font-semibold text-foreground truncate">
                  {chapter.title || t("reader.chapterUntitled", "Chapter {number}").replace("{number}", String(chapter.auto_label || chapter.order))}
                </h1>
              </div>
            </div>
          </section>
        )}

        {/* Focus mode: minimal title */}
        {focusMode && (
          <div className="pt-2">
            <p className="font-ui text-xs text-muted-foreground tracking-wide uppercase">{book.title}</p>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground mt-0.5">
              {chapter.title || t("reader.chapterUntitled", "Chapter {number}").replace("{number}", String(chapter.auto_label || chapter.order))}
            </h2>
          </div>
        )}

        {/* Font size — hidden in focus mode */}
        {!focusMode && (
          <div className="space-y-3">
            <div className="flex justify-end">
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
            <ReadingFontSizeControl value={fontSize} onChange={handleReadingFontSizeChange} />
          </div>
        )}

        <article ref={chapterBodyRef} data-reading-body="true" className={cn("reader-html prose-literary w-full text-foreground/90 transition-all duration-300 md:rounded-2xl md:border md:border-border/40 md:bg-card/30 md:p-8 md:shadow-sm", readingFontSizeClass)}>
          <div dangerouslySetInnerHTML={{ __html: chapter.body || `<p>${t("reader.chapterEmptyText", "This chapter has no text yet.")}</p>` }} />
        </article>

        {/* Chapter navigation at bottom */}
        <section className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-border/40">
          {previousChapter ? (
            <Link to={`/books/${canonicalBookIdentifier}/chapters/${previousChapter.id}`}>
              <Button variant="outline" className="gap-1.5 h-11 rounded-xl" style={{ touchAction: "manipulation" }}>
                <ArrowLeft className="h-4 w-4" /> {t("reader.previous", "Previous")}
              </Button>
            </Link>
          ) : <span />}
          <div className="ml-auto flex items-center gap-2">
            {isLastChapter && (
              <Link to={`/read/books/${canonicalBookIdentifier}`}>
                <Button
                  variant="outline"
                  className="gap-1.5 h-11 rounded-xl border-primary/40 text-primary hover:bg-primary/10"
                  style={{ touchAction: "manipulation" }}
                >
                  {t("reader.end", "End")}
                </Button>
              </Link>
            )}
            {nextChapter ? (
              <Link to={`/books/${canonicalBookIdentifier}/chapters/${nextChapter.id}`}>
                <Button variant="outline" className="gap-1.5 h-11 rounded-xl" style={{ touchAction: "manipulation" }}>
                  {t("reader.next", "Next")} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
          </div>
        </section>

        {/* Engagement — hidden in focus mode */}
        {!focusMode && <EngagementPanel category="chapters" identifier={chapter.id} />}

        {/* Keep an inline exit action at the very end of chapter page (popup action remains too) */}
        {focusMode && (
          <section className="pt-4 border-t border-border/30 flex justify-center">
            <Button
              variant="ghost"
              onClick={exitFocusMode}
              className="gap-2 h-10 rounded-xl text-muted-foreground hover:text-foreground"
              style={{ touchAction: "manipulation" }}
            >
              <Minimize2 className="h-4 w-4" /> {t("reader.exitFocus", "Exit Focus Mode")}
            </Button>
          </section>
        )}
      </div>

      {/* ══════════ IMMERSIVE FAB + DRAWER ══════════ */}
      <AnimatePresence>
        {focusMode && (
          <>
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

            {drawerOpen && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/30"
                onClick={() => setDrawerOpen(false)}
              />
            )}

            <AnimatePresence>
              {drawerOpen && (
                <motion.div
                  initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border/40 shadow-2xl overflow-hidden md:bottom-4 md:left-auto md:right-4 md:w-[30rem] lg:w-[34rem] md:rounded-2xl md:border"
                  style={{ background: "hsl(var(--card))", paddingBottom: "env(safe-area-inset-bottom)" }}
                >
                  <div className="flex justify-center py-2">
                    <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                  </div>
                  <div className="px-5 pb-5 pt-1 space-y-4 max-h-[70vh] overflow-y-auto md:max-h-[78vh] md:px-5 md:pb-5 md:space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-semibold text-foreground">{t("reader.readingMenu", "Reading Menu")}</h3>
                      <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" style={{ touchAction: "manipulation" }}>
                        <X className="h-5 w-5 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-ui text-xs text-muted-foreground">{t("reader.chapterProgress", "Chapter progress")}</span>
                        <span className="font-ui text-xs font-semibold text-foreground">{displayProgress.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, displayProgress)}%`, background: "var(--hero-gradient)" }} />
                      </div>
                    </div>

                    <ReadingFontSizeControl value={fontSize} onChange={handleReadingFontSizeChange} className="!mb-0 !mt-0" />

                    {/* Chapter nav */}
                    <div className="flex items-center gap-2">
                      {previousChapter ? (
                        <Link to={`/books/${canonicalBookIdentifier}/chapters/${previousChapter.id}`} className="flex-1" onClick={() => setDrawerOpen(false)}>
                          <Button variant="outline" size="sm" className="w-full gap-1 h-10 rounded-xl" style={{ touchAction: "manipulation" }}>
                            <ChevronLeft className="h-3.5 w-3.5" /> {t("reader.prev", "Prev")}
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="outline" size="sm" disabled className="flex-1 gap-1 h-10 rounded-xl">
                          <ChevronLeft className="h-3.5 w-3.5" /> {t("reader.prev", "Prev")}
                        </Button>
                      )}
                      <Link to={`/read/books/${canonicalBookIdentifier}`} onClick={() => { setDrawerOpen(false); exitFocusMode(); }}>
                        <Button variant="outline" size="sm" className="gap-1 h-10 rounded-xl px-3" style={{ touchAction: "manipulation" }}>
                          <BookOpen className="h-3.5 w-3.5" /> {t("reader.toc", "TOC")}
                        </Button>
                      </Link>
                      {nextChapter ? (
                        <Link to={`/books/${canonicalBookIdentifier}/chapters/${nextChapter.id}`} className="flex-1" onClick={() => setDrawerOpen(false)}>
                          <Button variant="outline" size="sm" className="w-full gap-1 h-10 rounded-xl" style={{ touchAction: "manipulation" }}>
                            {t("reader.next", "Next")} <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="outline" size="sm" disabled className="flex-1 gap-1 h-10 rounded-xl">
                          {t("reader.next", "Next")} <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {isLastChapter && (
                      <Link to={`/read/books/${canonicalBookIdentifier}`} onClick={() => setDrawerOpen(false)}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1 h-10 rounded-xl border-primary/40 text-primary hover:bg-primary/10"
                          style={{ touchAction: "manipulation" }}
                        >
                          {t("reader.end", "End")}
                        </Button>
                      </Link>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={async () => { await navigator.clipboard.writeText(shareLink); }}
                        className="gap-1.5 h-10 rounded-xl flex-1"
                        style={{ touchAction: "manipulation" }}
                      >
                        <Share2 className="h-3.5 w-3.5" /> {t("reader.share", "Share")}
                      </Button>
                    </div>

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
    </div>
  );
};

export default ReaderChapterReadPage;
