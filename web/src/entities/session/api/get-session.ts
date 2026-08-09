import { api } from "@/src/shared/api/client";
import { Session } from "../model/types";

export async function getSession(sessionId: string): Promise<Session> {
  const { data } = await api.get<Session>(`/sessions/details/${sessionId}`);

  return data;
}
