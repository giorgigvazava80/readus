import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ListTree } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchContentDetail, reviewContent } from "@/lib/api";
import type { ChapterDetail, ContentCategory } from "@/lib/types";

const allowedCategories: ContentCategory[] = ["books", "chapters", "poems", "stories"];

const statusStyles: Record<string, string> = {
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700",
};

const categoryLabels: Record<ContentCategory, string> = {
  books: "Book",
  chapters: "Chapter",
  poems: "Poem",
  stories: "Story",
};

interface BookContentSection {
  key: string;
  label: string;
  heading: string;
  html: string;
  kind: "foreword" | "chapter" | "afterword" | "uploaded_text";
  chapter?: ChapterDetail;
}

const AdminContentReadPage = () => {
  const { category: rawCategory, id: rawId } = useParams();
  const contentId = Number(rawId);
  const queryClient = useQueryClient();

  const category = allowedCategories.includes(rawCategory as ContentCategory)
    ? (rawCategory as ContentCategory)
    : null;

  const detailQuery = useQuery({
    queryKey: ["admin", "content-read", category, contentId],
    queryFn: () => fetchContentDetail(category as ContentCategory, contentId, { requiresAuth: true }),
    enabled: Boolean(category) && Number.isFinite(contentId),
  });

  const reviewMutation = useMutation({
    mutationFn: async (payload: {
      targetCategory: ContentCategory;
      targetId: number;
      status: "approved" | "rejected";
      reason: string;
    }) => reviewContent(payload.targetCategory, payload.targetId, payload.status, payload.reason),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "content-read"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "content-review"] });
      toast.success(`${variables.targetCategory.slice(0, -1)} ${variables.status}.`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Review update failed.";
      toast.error(message);
    },
  });

  const content = detailQuery.data;

  const chapters = useMemo(() => {
    if (category !== "books" || !content?.chapters) {
      return [];
    }

    return content.chapters.slice().sort((a, b) => a.order - b.order);
  }, [category, content?.chapters]);

  const chapterStats = useMemo(() => {
    const approved = chapters.filter((chapter) => chapter.status === "approved").length;
    const rejected = chapters.filter((chapter) => chapter.status === "rejected").length;
    const pending = chapters.filter((chapter) => chapter.status === "draft").length;

    return {
      approved,
      rejected,
      pending,
      total: chapters.length,
    };
  }, [chapters]);

  const bookSections = useMemo<BookContentSection[]>(() => {
    if (category !== "books" || !content) {
      return [];
    }

    const items: BookContentSection[] = [];

    if (content.foreword?.trim()) {
      items.push({
        key: "foreword",
        label: "Foreword",
        heading: "Foreword",
        html: content.foreword,
        kind: "foreword",
      });
    }

    chapters.forEach((chapter) => {
      const chapterLabel = chapter.title || `Chapter ${chapter.auto_label || chapter.order}`;
      items.push({
        key: `chapter-${chapter.id}`,
        label: chapterLabel,
        heading: chapterLabel,
        html: chapter.body || "<p>No chapter content yet.</p>",
        kind: "chapter",
        chapter,
      });
    });

    if (content.afterword?.trim()) {
      items.push({
        key: "afterword",
        label: "Afterword",
        heading: "Afterword",
        html: content.afterword,
        kind: "afterword",
      });
    }

    if (content.source_type === "upload" && content.extracted_text?.trim()) {
      items.push({
        key: "uploaded-text",
        label: "Uploaded Text",
        heading: "Uploaded Text",
        html: content.extracted_text,
        kind: "uploaded_text",
      });
    }

    return items;
  }, [category, content, chapters]);

  const [activeSectionKey, setActiveSectionKey] = useState<string>("");
  const [reasonByKey, setReasonByKey] = useState<Record<string, string>>({});

  useEffect(() => {
    if (category !== "books") {
      return;
    }

    if (!bookSections.length) {
      setActiveSectionKey("");
      return;
    }

    if (!bookSections.some((section) => section.key === activeSectionKey)) {
      setActiveSectionKey(bookSections[0].key);
    }
  }, [category, bookSections, activeSectionKey]);

  const activeBookSection = useMemo(() => {
    if (!bookSections.length) {
      return null;
    }
    return bookSections.find((section) => section.key === activeSectionKey) || bookSections[0];
  }, [bookSections, activeSectionKey]);

  const handleReview = (payload: {
    targetCategory: ContentCategory;
    targetId: number;
    status: "approved" | "rejected";
    reasonKey: string;
  }) => {
    const reason = (reasonByKey[payload.reasonKey] || "").trim();

    if (payload.status === "rejected" && !reason) {
      toast.error("Write rejection reason before rejecting.");
      return;
    }

    reviewMutation.mutate({
      targetCategory: payload.targetCategory,
      targetId: payload.targetId,
      status: payload.status,
      reason,
    });
  };

  if (!category || !Number.isFinite(contentId)) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">Invalid content path.</p>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">Loading content...</p>
      </div>
    );
  }

  if (detailQuery.isError || !content) {
    return (
      <div className="container mx-auto space-y-3 px-6 py-10">
        <p className="font-ui text-sm text-red-700">Could not load this content.</p>
        <Link to="/admin/content-review">
          <Button variant="outline">Back to review queue</Button>
        </Link>
      </div>
    );
  }

  const canApproveBook = chapterStats.total === 0 || (chapterStats.pending === 0 && chapterStats.rejected === 0);

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <Link to="/admin/content-review">
          <Button variant="ghost" size="sm" className="gap-1.5 font-ui text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to review queue
          </Button>
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-ui text-xs">
            {categoryLabels[category]}
          </Badge>
          <Badge variant="outline" className={statusStyles[content.status]}>
            {content.status}
          </Badge>
        </div>

        <h1 className="mt-3 font-display text-4xl font-semibold text-foreground">{content.title}</h1>
        <p className="mt-2 font-ui text-sm text-muted-foreground">
          by {content.author_name || content.author_username || "Unknown author"}  Created {new Date(content.created_at).toLocaleString()}
        </p>

        {content.rejection_reason ? (
          <p className="mt-4 rounded-lg border border-red-500/35 bg-red-500/10 p-3 font-ui text-sm text-red-700">
            Rejection reason: {content.rejection_reason}
          </p>
        ) : null}
      </section>

      {content.description ? (
        <section className="reader-html prose-literary rounded-2xl border border-border/70 bg-card/80 p-7 text-foreground/85 shadow-card">
          <div dangerouslySetInnerHTML={{ __html: content.description }} />
        </section>
      ) : null}

      {category === "books" ? (
        <>
          <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card">
            <h2 className="font-display text-2xl text-foreground">Book Approval Steps</h2>
            <p className="mt-1 font-ui text-sm text-muted-foreground">
              1) Review Foreword and every chapter, 2) fix rejected chapters, 3) approve the book when everything is approved.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-ui text-emerald-700">
                Approved chapters: {chapterStats.approved}
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-ui text-amber-700">
                Draft chapters: {chapterStats.pending}
              </span>
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-ui text-red-700">
                Rejected chapters: {chapterStats.rejected}
              </span>
            </div>

            {!canApproveBook ? (
              <p className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 font-ui text-sm text-amber-800">
                You cannot approve this book yet. First make all chapters approved.
              </p>
            ) : null}

            <Textarea
              className="mt-4 font-ui"
              placeholder="Book rejection reason (required only for reject)"
              value={reasonByKey.book || ""}
              onChange={(event) => setReasonByKey((prev) => ({ ...prev, book: event.target.value }))}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  handleReview({
                    targetCategory: "books",
                    targetId: content.id,
                    status: "approved",
                    reasonKey: "book",
                  })
                }
                disabled={reviewMutation.isPending || !canApproveBook}
              >
                Approve Book
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  handleReview({
                    targetCategory: "books",
                    targetId: content.id,
                    status: "rejected",
                    reasonKey: "book",
                  })
                }
                disabled={reviewMutation.isPending}
              >
                Reject Book
              </Button>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <aside className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-card lg:sticky lg:top-24 lg:h-fit">
              <div className="flex items-center gap-2">
                <ListTree className="h-4 w-4 text-primary" />
                <h2 className="font-display text-2xl text-foreground">Chapters</h2>
              </div>

              <div className="mt-4 space-y-2">
                {bookSections.length ? (
                  bookSections.map((section) => (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => setActiveSectionKey(section.key)}
                      className={`block w-full rounded-lg border px-3 py-2 text-left font-ui text-sm transition-colors ${
                        activeBookSection?.key === section.key
                          ? "border-primary/45 bg-primary/10 text-primary"
                          : "border-border/60 bg-background/65 text-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{section.label}</span>
                        {section.kind === "chapter" && section.chapter ? (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusStyles[section.chapter.status]}`}>
                            {section.chapter.status}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="font-ui text-sm text-muted-foreground">No readable sections yet.</p>
                )}
              </div>
            </aside>

            <article className="space-y-6 rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card lg:col-span-2">
              {content.upload_file ? (
                <p className="font-ui text-sm text-muted-foreground">
                  Uploaded file: <a className="underline" href={content.upload_file} target="_blank" rel="noreferrer">Open file</a>
                </p>
              ) : null}

              {activeBookSection ? (
                <div>
                  <h3 className="font-display text-2xl text-foreground">{activeBookSection.heading}</h3>
                  {activeBookSection.kind === "uploaded_text" ? (
                    <pre className="prose-literary mt-3 whitespace-pre-wrap text-foreground/90">{activeBookSection.html}</pre>
                  ) : (
                    <div
                      className="reader-html prose-literary mt-3 text-foreground/90"
                      dangerouslySetInnerHTML={{ __html: activeBookSection.html }}
                    />
                  )}
                </div>
              ) : (
                <p className="font-ui text-sm text-muted-foreground">No readable sections yet.</p>
              )}

              {activeBookSection?.kind === "chapter" && activeBookSection.chapter ? (
                <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-ui text-sm text-muted-foreground">Chapter status:</span>
                    <Badge variant="outline" className={statusStyles[activeBookSection.chapter.status]}>
                      {activeBookSection.chapter.status}
                    </Badge>
                  </div>

                  {activeBookSection.chapter.rejection_reason ? (
                    <p className="mt-3 rounded-lg border border-red-500/35 bg-red-500/10 p-3 font-ui text-sm text-red-700">
                      Current rejection: {activeBookSection.chapter.rejection_reason}
                    </p>
                  ) : null}

                  <Textarea
                    className="mt-3 font-ui"
                    placeholder="Chapter rejection reason (required only for reject)"
                    value={reasonByKey[activeBookSection.key] || ""}
                    onChange={(event) =>
                      setReasonByKey((prev) => ({
                        ...prev,
                        [activeBookSection.key]: event.target.value,
                      }))
                    }
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        handleReview({
                          targetCategory: "chapters",
                          targetId: activeBookSection.chapter!.id,
                          status: "approved",
                          reasonKey: activeBookSection.key,
                        })
                      }
                      disabled={reviewMutation.isPending}
                    >
                      Approve Chapter
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        handleReview({
                          targetCategory: "chapters",
                          targetId: activeBookSection.chapter!.id,
                          status: "rejected",
                          reasonKey: activeBookSection.key,
                        })
                      }
                      disabled={reviewMutation.isPending}
                    >
                      Reject Chapter
                    </Button>
                  </div>
                </div>
              ) : null}
            </article>
          </section>
        </>
      ) : (
        <>
          <article className="rounded-2xl border border-border/70 bg-card/80 p-8 text-foreground/90 shadow-card">
            {content.upload_file ? (
              <p className="mb-4 font-ui text-sm text-muted-foreground">
                Uploaded file: <a className="underline" href={content.upload_file} target="_blank" rel="noreferrer">Open file</a>
              </p>
            ) : null}

            {content.body ? (
              <div className="reader-html prose-literary" dangerouslySetInnerHTML={{ __html: content.body }} />
            ) : content.extracted_text ? (
              <pre className="prose-literary whitespace-pre-wrap">{content.extracted_text}</pre>
            ) : (
              <p className="font-ui text-sm text-muted-foreground">No text available.</p>
            )}
          </article>

          <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-card">
            <h2 className="font-display text-2xl text-foreground">Review Decision</h2>
            <Textarea
              className="mt-3 font-ui"
              placeholder="Rejection reason (required only for reject)"
              value={reasonByKey.content || ""}
              onChange={(event) => setReasonByKey((prev) => ({ ...prev, content: event.target.value }))}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  handleReview({
                    targetCategory: category,
                    targetId: content.id,
                    status: "approved",
                    reasonKey: "content",
                  })
                }
                disabled={reviewMutation.isPending}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  handleReview({
                    targetCategory: category,
                    targetId: content.id,
                    status: "rejected",
                    reasonKey: "content",
                  })
                }
                disabled={reviewMutation.isPending}
              >
                Reject
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminContentReadPage;
