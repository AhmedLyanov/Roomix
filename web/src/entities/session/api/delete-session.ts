import { api } from "@/src/shared/api/client";
export async function deleteSession(sessionId: string) {
  await api.delete(`/sessions/${sessionId}`);
}
