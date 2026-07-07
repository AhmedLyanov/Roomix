import { client } from "@/shared/api/client";

import { Session } from "../model/types";

export async function getSessions(userId: string) {
  const { data } = await client.get<Session[]>(`/sessions/${userId}`);

  return data;
}
