import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Clock, Share2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { fetchContentDetail, resolveMediaUrl } from "@/lib/api";
import type { ContentCategory, ContentDetail } from "@/lib/types";
import { useReadChapters } from "@/hooks/useReadChapters";
import { useCallback, useEffect, useMemo, useRef } from "react";

const categoryLabels: Record<ContentCategory, string> = {
  books: "წიგნი",
  chapters: "თავი",
  poems: "პოეზია",
  stories: "მოკლე მოთხრობა",
};

const allowedCategories: ContentCategory[] = ["books", "chapters", "poems", "stories"];

function stripHtml(value: string | undefined): string {
  return (value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hasTextContent(html?: string | null): boolean {
  if (!html) return false;
  const stripped = html.replace(/<[^>]+>/g, "").trim();
  return stripped.length > 0;
}

function estimateReadTime(content: ContentDetail): string {
  const parts = [
    content.description,
    content.body,
    content.foreword,
    content.afterword,
    ...(content.chapters?.map((chapter) => chapter.body) || []),
  ];

  const words = stripHtml(parts.join(" ")).split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return `${minutes} წთ კითხვის დრო`;
}

const PublicReadPage = () => {
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

  const currentPage = useMemo(() => {
    if (category !== "books") {
      return 1;
    }
    if (!rawPage) {
      return 0;
    }
    const parsed = Number.parseInt(rawPage, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  }, [category, rawPage]);

  const detailQuery = useQuery({
    queryKey: ["public-read", category, identifier],
    queryFn: () => fetchContentDetail(category as ContentCategory, identifier),
    enabled: Boolean(category) && Boolean(identifier),
  });

  const content = detailQuery.data;
  const canonicalIdentifier = (content?.public_slug || identifier).trim();
  const buildReadPath = useCallback((page: number) => {
    if (!category || !identifier) {
      return "/browse";
    }
    if (category !== "books" || page <= 0) {
      return `/read/${category}/${canonicalIdentifier}`;
    }
    return `/read/${category}/${canonicalIdentifier}/${page}`;
  }, [canonicalIdentifier, category, identifier]);

  const sections = useMemo(() => {
    if (!content || category !== "books") return [];
    const chapters = (content.chapters || []).slice().sort((a, b) => a.order - b.order);
    const s: { id: string; title: string; html: string }[] = [];

    if (hasTextContent(content.foreword)) {
      s.push({ id: 'foreword', title: 'წინასიტყვაობა', html: content.foreword! });
    }
    chapters.forEach((ch) => {
      s.push({
        id: `chapter-${ch.id}`,
        title: ch.title || `Chapter ${ch.auto_label || ch.order}`,
        html: ch.body || "<p>თავის ტექსტი არ არის.</p>"
      });
    });
    if (hasTextContent(content.afterword)) {
      s.push({ id: 'afterword', title: 'ბოლოსიტყვაობა', html: content.afterword! });
    }
    return s;
  }, [content, category]);

  useEffect(() => {
    if (currentPage > 0 && sections[currentPage - 1]) {
      const section = sections[currentPage - 1];
      if (section.id.startsWith("chapter-")) {
        const chapterId = parseInt(section.id.replace("chapter-", ""), 10);
        markAsRead(chapterId);
      }
    }
  }, [currentPage, sections, markAsRead]);

  // Backward compatibility for old links like /read/books/:id?page=:page
  useEffect(() => {
    if (category !== "books" || !legacyPageParam) {
      return;
    }

    const parsed = Number.parseInt(legacyPageParam, 10);
    const legacyPage = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    const target = buildReadPath(legacyPage);
    if (`${location.pathname}${location.search}` !== target) {
      navigate(target, { replace: true });
    }
  }, [buildReadPath, category, legacyPageParam, location.pathname, location.search, navigate]);

  // Canonicalize old id URLs to slug URLs once content is loaded.
  useEffect(() => {
    if (!category || !content?.public_slug || identifier === content.public_slug) {
      return;
    }
    const target = buildReadPath(currentPage);
    if (location.pathname !== target && !location.search) {
      navigate(target, { replace: true });
    }
  }, [
    buildReadPath,
    category,
    content?.public_slug,
    currentPage,
    identifier,
    location.pathname,
    location.search,
    navigate,
  ]);

  // Handle initial scroll on mount/refresh if section page exists
  useEffect(() => {
    if ((rawPage || legacyPageParam) && !detailQuery.isLoading && detailQuery.data) {
      setTimeout(() => {
        contentAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 500); // Small delay to ensure layout is ready
    }
  }, [detailQuery.isLoading, detailQuery.data, rawPage, legacyPageParam]);

  if (!category || !identifier) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">კონტენტის ბმული არასწორია</h1>
        <Link to="/browse">
          <Button variant="outline" className="mt-4">ბიბლიოთეკაში დაბრუნება</Button>
        </Link>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return <div className="container mx-auto px-6 py-24 text-center text-sm text-muted-foreground">იტვირთება...</div>;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">ნაშრომი ვერ მოიძებნა</h1>
        <Link to="/browse">
          <Button variant="outline" className="mt-4">ბიბლიოთეკაში დაბრუნება</Button>
        </Link>
      </div>
    );
  }

  const coverUrl = resolveMediaUrl(content.cover_image);

  const navigateToPage = (p: number) => {
    navigate(buildReadPath(p));
    contentAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <div className="relative border-b bg-background overflow-hidden">
        {/* Blurred backdrop background when cover is present */}
        {coverUrl && (
          <>
            <div
              className="absolute inset-0 opacity-[0.04] bg-cover bg-center blur-3xl saturate-150"
              style={{ backgroundImage: `url(${coverUrl})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </>
        )}

        <div className="container relative mx-auto px-6 py-8 md:py-12">
          <Link to="/browse">
            <Button variant="ghost" size="sm" className="mb-6 gap-1.5 font-ui text-sm text-muted-foreground -ml-3">
              <ArrowLeft className="h-3.5 w-3.5" /> ბიბლიოთეკაში დაბრუნება
            </Button>
          </Link>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {coverUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-40 md:w-56 flex-shrink-0 rounded-xl overflow-hidden shadow-2xl shadow-black/20 border border-border"
              >
                <img src={coverUrl} alt="Cover" className="w-full h-auto object-cover aspect-[2/3]" />
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 pt-2">
              <div className="mb-4 flex items-center gap-2">
                <Badge variant="secondary" className="font-ui text-xs">
                  {categoryLabels[category]}
                </Badge>
              </div>

              <h1 className="font-display text-3xl font-bold leading-tight text-foreground md:text-5xl lg:pr-12">
                {content.title}
              </h1>
              <p className="mt-4 font-ui text-lg text-muted-foreground">
                by {content.author_name || content.author_username || "უცნობი ავტორი"}
              </p>

              {content.description ? (
                <div
                  className="reader-html prose-literary mt-6 text-foreground/85"
                  dangerouslySetInnerHTML={{ __html: content.description }}
                />
              ) : null}

              <div className="mt-8 flex flex-wrap items-center gap-3 font-ui text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-md border border-border/50">
                  <Clock className="h-3.5 w-3.5" /> {estimateReadTime(content)}
                </span>
                <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-md border border-border/50">
                  <Calendar className="h-3.5 w-3.5" /> {new Date(content.created_at).toLocaleDateString()}
                </span>
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground md:ml-4 border border-transparent hover:bg-secondary">
                  <Share2 className="h-3.5 w-3.5" /> Share
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.article
        ref={contentAreaRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="container mx-auto px-6 py-12 scroll-mt-20"
      >
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 h-1.5 w-16 rounded-full bg-primary" />

          {content.upload_file ? (
            <p className="mb-6 text-sm text-muted-foreground">
              ატვირთული ფაილი: <a className="underline" href={content.upload_file} target="_blank" rel="noreferrer">ფაილის გახსნა</a>
            </p>
          ) : null}

          {category === "books" ? (
            <div className="space-y-8">
              {sections.length > 0 ? (
                currentPage === 0 ? (
                  <section className="animate-in fade-in duration-500">
                    <h2 className="font-display text-3xl font-semibold text-foreground mb-6">სარჩევი</h2>
                    <div className="flex flex-col gap-3">
                      {sections.map((sec, idx) => {
                        const isChapter = sec.id.startsWith("chapter-");
                        const chapterId = isChapter ? parseInt(sec.id.replace("chapter-", ""), 10) : null;
                        const showNew = isChapter && chapterId !== null && !isRead(chapterId);

                        return (
                          <button
                            key={sec.id}
                            onClick={() => navigateToPage(idx + 1)}
                            className="text-left flex justify-between items-center font-ui text-lg text-primary hover:text-primary/80 hover:underline transition-colors border border-border/50 bg-background/50 rounded-lg p-4"
                          >
                            <span>
                              <span className="text-muted-foreground mr-3">{idx + 1}.</span> {sec.title}
                            </span>
                            {showNew && (
                              <span className="flex-shrink-0 ml-2 rounded-full px-2 py-0.5 text-xs uppercase font-bold tracking-wider bg-blue-500/20 text-blue-500 no-underline">
                                New
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : sections[currentPage - 1] ? (
                  <section className="animate-in fade-in duration-500 key={currentPage}">
                    <h2 className="font-display text-3xl font-semibold text-foreground mb-6">{sections[currentPage - 1].title}</h2>
                    <div
                      className="reader-html prose-literary text-foreground/90"
                      dangerouslySetInnerHTML={{ __html: sections[currentPage - 1].html }}
                    />
                  </section>
                ) : (
                  <p className="font-ui text-sm text-muted-foreground">გვერდი ვერ მოიძებნა.</p>
                )
              ) : content.extracted_text ? (
                <section>
                  <h2 className="font-display text-2xl font-semibold text-foreground">ატვირთული ტექსტი</h2>
                  <pre className="prose-literary mt-3 whitespace-pre-wrap text-foreground/90">{content.extracted_text}</pre>
                </section>
              ) : (
                <p className="font-ui text-sm text-muted-foreground">წაკითხვადი ტექსტი ხელმისაწვდომი არ არის.</p>
              )}
            </div>
          ) : content.body ? (
            <div
              className="reader-html prose-literary text-foreground/90"
              dangerouslySetInnerHTML={{ __html: content.body }}
            />
          ) : content.extracted_text ? (
            <pre className="prose-literary whitespace-pre-wrap text-foreground/90">{content.extracted_text}</pre>
          ) : (
            <p className="font-ui text-sm text-muted-foreground">წაკითხვადი ტექსტი ხელმისაწვდომი არ არის.</p>
          )}

          {category === "books" && sections.length > 0 && (
            <div className="mt-16 flex flex-wrap items-center justify-center gap-2">
              <Button
                variant={currentPage === 0 ? "default" : "outline"}
                onClick={() => navigateToPage(0)}
                className={`font-ui ${currentPage !== 0 ? "bg-background" : ""}`}
              >
                სარჩევი
              </Button>
              {sections.map((sec, idx) => (
                <Button
                  key={sec.id}
                  variant={currentPage === idx + 1 ? "default" : "outline"}
                  onClick={() => navigateToPage(idx + 1)}
                  className={`w-10 h-10 p-0 font-ui ${currentPage !== idx + 1 ? 'bg-background' : ''}`}
                >
                  {idx + 1}
                </Button>
              ))}
            </div>
          )}

          <Separator className="my-12" />

          <div className="text-center">
            <p className="font-display text-lg italic text-muted-foreground">პრევიუს დასასრული</p>
            <p className="mt-2 font-ui text-sm text-muted-foreground">
              შემოუერთდი როგორც მკითხველი, რომ მოიწონო, დააკომენტარო და გამოიწერო ავტორები.
            </p>
          </div>
        </div>
      </motion.article>
    </div>
  );
};

export default PublicReadPage;




