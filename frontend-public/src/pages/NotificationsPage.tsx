import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BookOpen, CheckCheck, Heart, MessageSquare, Star, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { fetchNotifications, markNotificationRead, markNotificationsRead } from "@/lib/api";

function toTargetPath(metadata: Record<string, unknown>): string | null {
  const category = String(metadata.target_category || "");
  const identifier = String(metadata.target_identifier || "");
  if (category && identifier) {
    return `/read/${category}/${identifier}`;
  }
  const followerUsername = String(metadata.follower_username || "");
  if (followerUsername) {
    return `/authors/${followerUsername}`;
  }
  return null;
}

/** Pick an icon based on notification type keyword in the title */
function NotifIcon({ title }: { title: string }) {
  const lower = title.toLowerCase();
  let Icon = Bell;
  let bg = "hsl(var(--muted))";
  let color = "hsl(var(--muted-foreground))";

  if (lower.includes("like") || lower.includes("liked")) {
    Icon = Heart;
    bg = "hsl(0 72% 51% / 0.12)";
    color = "hsl(0 72% 51%)";
  } else if (lower.includes("comment") || lower.includes("reply")) {
    Icon = MessageSquare;
    bg = "hsl(215 40% 45% / 0.12)";
    color = "hsl(215 40% 45%)";
  } else if (lower.includes("follow") || lower.includes("subscriber")) {
    Icon = UserPlus;
    bg = "hsl(150 35% 45% / 0.12)";
    color = "hsl(150 35% 45%)";
  } else if (lower.includes("rating") || lower.includes("star") || lower.includes("review")) {
    Icon = Star;
    bg = "hsl(36 70% 50% / 0.12)";
    color = "hsl(36 70% 50%)";
  } else if (lower.includes("publish") || lower.includes("approved") || lower.includes("book")) {
    Icon = BookOpen;
    bg = "hsl(36 70% 50% / 0.12)";
    color = "hsl(36 70% 50%)";
  }

  return (
    <div
      className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full"
      style={{ background: bg }}
    >
      <Icon className="h-5 w-5" style={{ color }} />
    </div>
  );
}

/** Skeleton row */
function NotifSkeleton() {
  return (
    <div className="flex gap-3 p-4 rounded-2xl border border-border/30 animate-pulse">
      <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-2/3" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-2 bg-muted rounded w-1/4 mt-1" />
      </div>
    </div>
  );
}

const NotificationsPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications", 1],
    queryFn: () => fetchNotifications(1),
  });

  const markAllMutation = useMutation({
    mutationFn: () => markNotificationsRead({ all: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: number) => markNotificationRead(id, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
  });

  const rows = useMemo(() => notificationsQuery.data?.results || [], [notificationsQuery.data?.results]);
  const unreadCount = rows.filter((r) => !r.is_read).length;

  return (
    <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 pb-24 md:pb-10 max-w-2xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-border/40 mb-5">
        <div className="flex items-center gap-2.5">
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl md:text-2xl font-semibold text-foreground">{t("nav.notifications", "Notifications")}</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold font-ui text-primary-foreground" style={{ background: "var(--hero-gradient)" }}>
              {unreadCount}
            </span>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => markAllMutation.mutate()}
          disabled={markAllMutation.isPending || rows.length === 0 || unreadCount === 0}
          className="gap-1.5 h-9 text-xs font-medium"
          style={{ touchAction: "manipulation" } as React.CSSProperties}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Mark all read</span>
        </Button>
      </div>

      {/* ── Loading skeleton ── */}
      {notificationsQuery.isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <NotifSkeleton key={i} />)}
        </div>
      ) : notificationsQuery.isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-ui text-sm text-destructive">Could not load notifications.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mb-2">
            <Bell className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="font-ui text-base text-foreground font-medium">No notifications yet.</p>
          <p className="font-ui text-sm text-muted-foreground max-w-[240px]">
            When you get updates about stories or comments, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((item) => {
            const targetPath = toTargetPath(item.metadata || {});
            return (
              <button
                key={item.id}
                type="button"
                style={{ touchAction: "manipulation" } as React.CSSProperties}
                onClick={async () => {
                  if (!item.is_read) {
                    await markOneMutation.mutateAsync(item.id);
                  }
                  if (targetPath) {
                    navigate(targetPath);
                  }
                }}
                className={`group w-full text-left rounded-2xl border transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary ${item.is_read
                  ? "border-border/40 bg-card/40 hover:bg-card/80 hover:border-border/60"
                  : "border-primary/20 bg-primary/5 hover:bg-primary/10 shadow-sm"
                  }`}
              >
                <div className="flex items-start gap-3 p-3.5 sm:p-4">
                  {/* Unread accent bar */}
                  {!item.is_read && (
                    <div
                      className="self-stretch flex-shrink-0 rounded-full"
                      style={{ width: 3, background: "var(--hero-gradient)" }}
                    />
                  )}

                  {/* Icon */}
                  <NotifIcon title={item.title} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-sm sm:text-base font-medium text-foreground leading-snug">
                        {item.title}
                      </p>
                      <span className="font-ui text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 font-ui text-xs sm:text-sm text-foreground/75 leading-relaxed">
                      {item.message}
                    </p>
                    {targetPath && (
                      <p className="mt-2 font-ui text-xs font-semibold text-primary group-hover:underline">
                        View Details →
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
