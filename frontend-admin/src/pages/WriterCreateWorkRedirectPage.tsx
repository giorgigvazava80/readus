import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createBook, createPoem, createStory } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface WriterCreateWorkRedirectPageProps {
  type: "books" | "poems" | "stories";
}

const WriterCreateWorkRedirectPage = ({ type }: WriterCreateWorkRedirectPageProps) => {
  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: async () => {
      if (type === "books") {
        const created = await createBook({
          title: "Untitled Book",
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
          title: "Untitled Poem",
          description: "",
          body: "<p>Start writing your poem...</p>",
          source_type: "manual",
        });
        return `/writer/poems/${created.id}/edit`;
      }

      const created = await createStory({
        title: "Untitled Story",
        description: "",
        body: "<p>Start writing your story...</p>",
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
        title: "Unable to create draft",
        description: error instanceof Error ? error.message : "Try again.",
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
      <p className="font-ui text-sm text-muted-foreground">Creating draft editor...</p>
    </div>
  );
};

export default WriterCreateWorkRedirectPage;
