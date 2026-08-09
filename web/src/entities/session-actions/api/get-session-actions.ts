import { api } from "@/src/shared/api/client";

import type { SessionAction } from "../model/types";

export async function getSessionActions(sessionId: string) {
  const { data } = await api.get<SessionAction[]>(
    `/sessions/${sessionId}/actions`,
  );

  return data;
}
