import { api } from "@/src/shared/api/client";
import { Session } from "../model/types";

export async function getSessions(userId: string) {
  const { data } = await api.get<Session[]>(`/sessions/${userId}`);

  return data;
}
