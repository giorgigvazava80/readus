import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Reply } from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/use-toast";
import {
  createComment,
  fetchComments,
  fetchLikeSummary,
  likeContent,
  moderateComment,
  unlikeContent,
} from "@/lib/api";
import type { ContentCategory, ContentCommentItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface EngagementPanelProps {
  category: ContentCategory;
  identifier: string | number;
  className?: string;
}

function formatRelative(dateValue: string): string {
  const delta = Date.now() - new Date(dateValue).getTime();
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const EngagementPanel = ({ category, identifier, className }: EngagementPanelProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { me } = useSession();
  const [newComment, setNewComment] = useState("");
  const [replyParentId, setReplyParentId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const queryKeyBase = useMemo(() => ["engagement", category, identifier], [category, identifier]);

  const likesQuery = useQuery({
    queryKey: [...queryKeyBase, "likes"],
    queryFn: () => fetchLikeSummary(category, identifier),
  });

  const commentsQuery = useQuery({
    queryKey: [...queryKeyBase, "comments"],
    queryFn: () => fetchComments(category, identifier, 1),
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (likesQuery.data?.liked_by_me) {
        return unlikeContent(category, identifier);
      }
      return likeContent(category, identifier);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeyBase, "likes"] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: error.message || "Could not update like." });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (payload: { body: string; parent_id?: number }) =>
      createComment(category, identifier, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeyBase, "comments"] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: error.message || "Could not post comment." });
    },
  });

  const moderateMutation = useMutation({
    mutationFn: async (payload: { commentId: number; isHidden: boolean }) =>
      moderateComment(payload.commentId, {
        is_hidden: payload.isHidden,
        reason: payload.isHidden ? "Hidden by moderator" : "",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeyBase, "comments"] });
    },
  });

  const comments = commentsQuery.data?.results || [];

  const handlePostComment = async () => {
    const body = newComment.trim();
    if (!body) return;
    await commentMutation.mutateAsync({ body });
    setNewComment("");
  };

  const handlePostReply = async (parentId: number) => {
    const body = replyBody.trim();
    if (!body) return;
    await commentMutation.mutateAsync({ body, parent_id: parentId });
    setReplyBody("");
    setReplyParentId(null);
  };

  const renderComment = (item: ContentCommentItem, depth = 0) => (
    <div
      key={item.id}
      className={cn(
        "rounded-lg border border-border/60 bg-background/70 p-3",
        depth > 0 ? "ml-5 mt-2" : "mt-3",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-ui text-sm font-medium text-foreground">{item.user_display_name}</p>
          <p className="font-ui text-[11px] text-muted-foreground">{formatRelative(item.created_at)}</p>
        </div>
        {item.can_moderate ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => moderateMutation.mutate({ commentId: item.id, isHidden: !item.is_hidden })}
            disabled={moderateMutation.isPending}
          >
            {item.is_hidden ? "Unhide" : "Hide"}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 font-ui text-sm text-foreground/90 whitespace-pre-wrap">{item.body}</p>

      {me ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 h-7 px-2 text-xs"
          onClick={() => {
            setReplyParentId(replyParentId === item.id ? null : item.id);
            setReplyBody("");
          }}
        >
          <Reply className="mr-1 h-3 w-3" />
          Reply
        </Button>
      ) : null}

      {replyParentId === item.id ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={replyBody}
            onChange={(event) => setReplyBody(event.target.value)}
            placeholder="Write a reply..."
            className="min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handlePostReply(item.id)}
              disabled={commentMutation.isPending || !replyBody.trim()}
            >
              Post reply
            </Button>
            <Button size="sm" variant="outline" onClick={() => setReplyParentId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {(item.replies || []).map((reply) => renderComment(reply, depth + 1))}
    </div>
  );

  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card/80 p-5 shadow-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h3 className="font-display text-xl text-foreground">Community</h3>
        </div>
        <Button
          variant={likesQuery.data?.liked_by_me ? "default" : "outline"}
          size="sm"
          onClick={() => likeMutation.mutate()}
          disabled={!me || likeMutation.isPending}
        >
          <Heart className={cn("mr-1 h-4 w-4", likesQuery.data?.liked_by_me ? "fill-current" : "")} />
          {likesQuery.data?.likes_count ?? 0}
        </Button>
      </div>

      {me ? (
        <div className="mt-4 space-y-2">
          <Textarea
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            placeholder="Write a comment..."
            className="min-h-[90px]"
          />
          <Button onClick={handlePostComment} disabled={commentMutation.isPending || !newComment.trim()}>
            Post comment
          </Button>
        </div>
      ) : (
        <p className="mt-4 font-ui text-sm text-muted-foreground">Sign in to like and comment.</p>
      )}

      <div className="mt-4">
        {comments.map((item) => renderComment(item))}
        {!comments.length ? (
          <p className="font-ui text-sm text-muted-foreground">No comments yet.</p>
        ) : null}
      </div>
    </section>
  );
};

export default EngagementPanel;
