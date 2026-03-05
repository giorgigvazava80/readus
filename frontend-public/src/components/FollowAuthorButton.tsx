import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { useSession } from "@/hooks/useSession";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { fetchAuthorFollowState, followAuthor, unfollowAuthor } from "@/lib/api";
import { Button } from "@/components/ui/button";


interface FollowAuthorButtonProps {
  authorId?: number | null;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

const FollowAuthorButton = ({
  authorId,
  className,
  variant = "outline",
  size = "sm",
}: FollowAuthorButtonProps) => {
  const { me } = useSession();
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const canFollow = Boolean(me && authorId && me.id !== authorId);

  const stateQuery = useQuery({
    queryKey: ["author-follow-state", authorId],
    queryFn: () => fetchAuthorFollowState(Number(authorId)),
    enabled: canFollow,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!authorId) {
        throw new Error(t("follow.errorMissingAuthor", "Author is missing."));
      }
      const isFollowing = Boolean(stateQuery.data?.is_following);
      return isFollowing ? unfollowAuthor(authorId) : followAuthor(authorId);
    },
    onSuccess: () => {
      if (!authorId) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["author-follow-state", authorId] });
      queryClient.invalidateQueries({ queryKey: ["public-author"] });
      queryClient.invalidateQueries({ queryKey: ["public-authors"] });
      queryClient.invalidateQueries({ queryKey: ["my-following-authors"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: error.message || t("follow.errorActionFailed", "Follow action failed."),
      });
    },
  });

  if (!canFollow) {
    return null;
  }

  const isFollowing = Boolean(stateQuery.data?.is_following);
  const handleClick = async () => {
    if (isFollowing) {
      const isConfirmed = await confirm({
        title: t("follow.confirmUnfollowTitle", "Unfollow author?"),
        description: t("follow.confirmUnfollowDesc", "You will stop receiving updates from this author."),
        confirmText: t("follow.unfollow", "Unfollow"),
        cancelText: t("confirm.cancel", "Cancel"),
      });
      if (!isConfirmed) return;
    }

    followMutation.mutate();
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={followMutation.isPending || stateQuery.isLoading}
    >
      {followMutation.isPending
        ? t("follow.processing", "Please wait...")
        : isFollowing
          ? t("follow.unfollow", "Unfollow")
          : t("follow.followAuthor", "Follow Author")}
    </Button>
  );
};

export default FollowAuthorButton;
