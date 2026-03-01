import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchMe, getStoredMe, isAuthenticated } from "@/lib/api";

export function useSession() {
  const queryClient = useQueryClient();
  const hasToken = isAuthenticated();
  const storedMe = getStoredMe();

  const query = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: hasToken,
    initialData: storedMe ?? undefined,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: !storedMe,
  });

  useEffect(() => {
    const handler = () => {
      if (!isAuthenticated()) {
        queryClient.setQueryData(["me"], null);
        return;
      }

      const cached = getStoredMe();
      if (cached) {
        queryClient.setQueryData(["me"], cached);
      }
      queryClient.invalidateQueries({ queryKey: ["me"], refetchType: "all" });
    };

    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
  }, [queryClient]);

  const isSessionLoading = hasToken && !query.data && (query.isLoading || query.isFetching);

  return {
    me: query.data,
    isLoading: isSessionLoading,
    isAuthenticated: Boolean(hasToken && query.data),
    refetch: query.refetch,
  };
}
