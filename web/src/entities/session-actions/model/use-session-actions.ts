import { useQuery } from "@tanstack/react-query";

import { getSessionActions } from "../api/get-session-actions";

export function useSessionActions(sessionId: string) {
  return useQuery({
    queryKey: ["session-actions", sessionId],
    queryFn: () => getSessionActions(sessionId),
    enabled: Boolean(sessionId),
  });
}
