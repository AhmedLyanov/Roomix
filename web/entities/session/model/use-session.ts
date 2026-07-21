import { useQuery } from "@tanstack/react-query";

import { getSession } from "../api/get-session";

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: ["session", sessionId],

    queryFn: () => getSession(sessionId),

    enabled: Boolean(sessionId),
  });
}
