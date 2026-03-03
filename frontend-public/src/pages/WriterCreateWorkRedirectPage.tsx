import { useI18n } from "@/i18n";
import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createBook, createPoem, createStory } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface WriterCreateWorkRedirectPageProps {
  type: "books" | "poems" | "stories";
}

const WriterCreateWorkRedirectPage = ({ type }: WriterCreateWorkRedirectPageProps) => {
  const { t } = useI18n();
  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: async () => {
      if (type === "books") {
        const created = await createBook({
          title: t("editor.untitledBook"),
          description: "",
          foreword: "<p></p>",
          afterword: "<p></p>",
          numbering_style: "separator",
          source_type: "manual",
        });
        return `/writer/books/${created.id}/edit`;
      }

      if (type === "poems") {
        const created = await createPoem({
          title: t("editor.untitledPoem"),
          description: "",
          body: `<p>${t("editor.startPoem")}</p>`,
          source_type: "manual",
        });
        return `/writer/poems/${created.id}/edit`;
      }

      const created = await createStory({
        title: t("editor.untitledStory"),
        description: "",
        body: `<p>${t("editor.startStory")}</p>`,
        source_type: "manual",
      });
      return `/writer/stories/${created.id}/edit`;
    },
    onSuccess: (route) => {
      navigate(route, { replace: true });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: t("editor.draftFailed"),
        description: error instanceof Error ? error.message : "სცადე ხელახლა.",
      });
      navigate("/writer/new", { replace: true });
    },
  });

  useEffect(() => {
    if (!createMutation.isPending && !createMutation.isSuccess) {
      createMutation.mutate();
    }
  }, [createMutation]);

  return (
    <div className="container mx-auto px-6 py-10">
      <p className="font-ui text-sm text-muted-foreground">{t("editor.draftCreating")}</p>
    </div>
  );
};

export default WriterCreateWorkRedirectPage;


