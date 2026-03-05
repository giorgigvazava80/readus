import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";

import { authorProfilePath } from "@/lib/authors";
import { fetchMyFollowingAuthors, resolveMediaUrl } from "@/lib/api";
import { useI18n } from "@/i18n";

function formatDate(value: string): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
}

const FollowingFeedPage = () => {
  const { t } = useI18n();
  const feedQuery = useQuery({
    queryKey: ["my-following-authors", 1],
    queryFn: () => fetchMyFollowingAuthors(1),
  });

  if (feedQuery.isLoading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p className="font-ui text-sm text-muted-foreground">{t("following.loading", "Loading feed...")}</p>
      </div>
    );
  }

  if (feedQuery.isError) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p className="font-ui text-sm text-red-700">{t("following.error", "Could not load following feed.")}</p>
      </div>
    );
  }

  const items = feedQuery.data?.results || [];

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-foreground">{t("following.title", "Following Authors")}</h1>
        <p className="mt-1 font-ui text-sm text-muted-foreground">
          {t("following.subtitle", "Quick list of authors you follow.")}
        </p>
      </div>

      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={`follow-${item.author_id}`}
              to={authorProfilePath(item.author_username)}
              className="block rounded-xl border border-border/60 bg-card/80 p-4 shadow-card transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                {item.profile_photo ? (
                  <img
                    src={resolveMediaUrl(item.profile_photo) || ""}
                    alt={item.author_display_name}
                    className="h-11 w-11 rounded-full object-cover border border-border/60"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-full border border-border/60 bg-muted/40 flex items-center justify-center font-ui text-sm text-muted-foreground">
                    {item.author_display_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-2xl text-foreground truncate">{item.author_display_name}</h2>
                  <p className="font-ui text-sm text-muted-foreground truncate">@{item.author_username}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 font-ui text-xs text-muted-foreground">
                <span>{t("following.followers", "{count} followers").replace("{count}", String(item.follower_count))}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  {t("following.followedAt", "Followed {date}").replace("{date}", formatDate(item.followed_at))}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/80 bg-background/65 p-8 text-center">
          <p className="font-ui text-sm text-muted-foreground">
            {t("following.empty", "Follow authors to build your list.")}
          </p>
        </div>
      )}
    </div>
  );
};

export default FollowingFeedPage;
