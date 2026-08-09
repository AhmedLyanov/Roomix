import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteSession } from "../api/delete-session";

export function useDeleteSession(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSession,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["sessions", userId],
      });
    },
  });
}
