import { client } from "@/shared/api/client";

export async function deleteSession(sessionId: string) {
  await client.delete(`/sessions/${sessionId}`);
}
