import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, EyeOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchContentDetail } from "@/lib/api";
import { estimateReadTimeFromHtml } from "@/lib/content";

interface ReaderTextWorkPageProps {
  type: "poems" | "stories";
}

const labels = {
  poems: "Poem",
  stories: "Story",
};

const listPath = {
  poems: "/poems",
  stories: "/stories",
};

const ReaderTextWorkPage = ({ type }: ReaderTextWorkPageProps) => {
  const { identifier } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const contentIdentifier = (identifier || "").trim();

  const detailQuery = useQuery({
    queryKey: ["reader", type, contentIdentifier],
    queryFn: () => fetchContentDetail(type, contentIdentifier),
    enabled: Boolean(contentIdentifier),
  });

  useEffect(() => {
    if (!detailQuery.data?.public_slug || contentIdentifier === detailQuery.data.public_slug) {
      return;
    }
    const target = `/${type}/${detailQuery.data.public_slug}`;
    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [contentIdentifier, detailQuery.data?.public_slug, location.pathname, navigate, type]);

  if (!contentIdentifier) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">Invalid link.</p>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <p className="font-ui text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="container mx-auto px-6 py-10 space-y-4">
        <p className="font-ui text-sm text-red-700">Work not found.</p>
        <Link to={listPath[type]}>
          <Button variant="outline">Back to list</Button>
        </Link>
      </div>
    );
  }

  const work = detailQuery.data;

  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <Link to={listPath[type]}>
          <Button variant="ghost" size="sm" className="gap-1.5 font-ui text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to {type}
          </Button>
        </Link>

        <p className="mt-4 font-ui text-xs uppercase tracking-wide text-muted-foreground">{labels[type]}</p>
        <div className="flex items-center justify-between gap-4 mt-2">
          <h1 className="font-display text-4xl font-semibold text-foreground">{work.title}</h1>
          {work.is_hidden && (
            <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 gap-1.5 px-3 py-1">
              <EyeOff className="h-4 w-4" />
              Hidden from Public
            </Badge>
          )}
        </div>
        <p className="mt-2 font-ui text-sm text-muted-foreground">
          by {work.author_name || work.author_username || "Unknown author"} - {estimateReadTimeFromHtml(work.body || work.extracted_text || work.description)}
        </p>
      </section>

      {work.description ? (
        <section className="reader-html prose-literary rounded-2xl border border-border/70 bg-card/80 p-7 text-foreground/85 shadow-card" dangerouslySetInnerHTML={{ __html: work.description }} />
      ) : null}

      <article className="rounded-2xl border border-border/70 bg-card/80 p-8 text-foreground/90 shadow-card">
        {work.body ? (
          <div className="reader-html prose-literary" dangerouslySetInnerHTML={{ __html: work.body }} />
        ) : work.extracted_text ? (
          <pre className="prose-literary whitespace-pre-wrap">{work.extracted_text}</pre>
        ) : (
          <p className="font-ui text-sm text-muted-foreground">No text available.</p>
        )}
      </article>
    </div>
  );
};

export default ReaderTextWorkPage;
