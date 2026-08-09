import { useQuery } from "@tanstack/react-query";

import { getSessions } from "../api/get-sessions";

export function useSessions(userId: string) {
  return useQuery({
    queryKey: ["sessions", userId],
    queryFn: () => getSessions(userId),
    enabled: !!userId,
  });
}
