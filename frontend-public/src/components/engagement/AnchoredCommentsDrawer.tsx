import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Reply } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/useSession";
import {
  createAnchoredComment,
  fetchAnchoredComments,
  hideComment,
  type EngagementTargetType,
  type WorkTypeFilter,
} from "@/lib/api";
import type { ContentCommentItem } from "@/lib/types";

interface AnchorSelection {
  anchorType: "block" | "paragraph";
  anchorKey: string;
  paragraphIndex: number | null;
  previewText: string;
}

interface AnchoredCommentsDrawerProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  targetType: EngagementTargetType;
  targetId: number;
  workType?: WorkTypeFilter;
  anchor: AnchorSelection | null;
}

function matchesAnchor(item: ContentCommentItem, anchor: AnchorSelection | null): boolean {
  if (!anchor) return false;
  if (item.anchor_type === anchor.anchorType && item.anchor_key === anchor.anchorKey) return true;
  if (anchor.paragraphIndex !== null && item.paragraph_index === anchor.paragraphIndex) return true;
  return false;
}

const AnchoredCommentsDrawer = ({
  open,
  onOpenChange,
  targetType,
  targetId,
  workType,
  anchor,
}: AnchoredCommentsDrawerProps) => {
  const { me } = useSession();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [replyParentId, setReplyParentId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const queryKey = useMemo(
    () => ["anchored-comments", targetType, targetId, workType],
    [targetType, targetId, workType],
  );

  const commentsQuery = useQuery({
    queryKey,
    queryFn: () => fetchAnchoredComments(targetType, targetId, { workType, page: 1 }),
    enabled: open && Boolean(anchor),
  });

  const createMutation = useMutation({
    mutationFn: createAnchoredComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const hideMutation = useMutation({
    mutationFn: ({ commentId, isHidden }: { commentId: number; isHidden: boolean }) =>
      hideComment(commentId, {
        is_hidden: isHidden,
        reason: isHidden ? "Hidden by moderator" : "Restored by moderator",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const comments = useMemo(() => {
    const rows = commentsQuery.data?.results || [];
    return rows.filter((item) => matchesAnchor(item, anchor));
  }, [commentsQuery.data?.results, anchor]);

  const onPost = async () => {
    if (!anchor || !body.trim()) return;
    await createMutation.mutateAsync({
      targetType,
      targetId,
      workType,
      anchorType: anchor.anchorType,
      anchorKey: anchor.anchorKey,
      paragraphIndex: anchor.paragraphIndex,
      body: body.trim(),
    });
    setBody("");
  };

  const onReply = async (parentId: number) => {
    if (!anchor || !replyBody.trim()) return;
    await createMutation.mutateAsync({
      targetType,
      targetId,
      workType,
      anchorType: anchor.anchorType,
      anchorKey: anchor.anchorKey,
      paragraphIndex: anchor.paragraphIndex,
      body: replyBody.trim(),
      parentComment: parentId,
    });
    setReplyParentId(null);
    setReplyBody("");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="inline-flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Inline Comments
          </DrawerTitle>
          <DrawerDescription>
            {anchor ? `Anchor ${anchor.anchorKey}${anchor.previewText ? `: ${anchor.previewText}` : ""}` : "Select paragraph"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-5 space-y-3 overflow-auto">
          {me ? (
            <div className="space-y-2">
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write a comment for this paragraph..."
                className="min-h-[88px]"
              />
              <Button onClick={onPost} disabled={createMutation.isPending || !body.trim()}>
                Post comment
              </Button>
            </div>
          ) : (
            <p className="font-ui text-sm text-muted-foreground">Sign in to comment on this paragraph.</p>
          )}

          <div className="space-y-4 pt-2">
            {comments.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/40 bg-card/60 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-ui text-sm font-medium">{item.user_display_name}</p>
                  {item.can_moderate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => hideMutation.mutate({ commentId: item.id, isHidden: !item.is_hidden })}
                    >
                      {item.is_hidden ? "Unhide" : "Hide"}
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 font-ui text-sm whitespace-pre-wrap text-foreground/90">{item.body}</p>

                {me ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 px-2 text-xs"
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
                      className="min-h-[70px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => onReply(item.id)} disabled={createMutation.isPending || !replyBody.trim()}>
                        Post reply
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setReplyParentId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {(item.replies || []).map((reply) => (
                  <div key={reply.id} className="mt-3 ml-2 pl-3 border-l-2 border-border/40 bg-transparent py-1">
                    <p className="font-ui text-xs font-semibold text-foreground/80">{reply.user_display_name}</p>
                    <p className="mt-1 font-ui text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{reply.body}</p>
                  </div>
                ))}
              </div>
            ))}
            {!comments.length ? (
              <p className="font-ui text-sm text-muted-foreground">No comments for this anchor yet.</p>
            ) : null}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default AnchoredCommentsDrawer;
