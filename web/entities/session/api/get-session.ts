import { client } from "@/shared/api/client";

import { Session } from "../model/types";

export async function getSession(sessionId: string): Promise<Session> {
  const { data } = await client.get<Session>(`/sessions/details/${sessionId}`);

  return data;
}
