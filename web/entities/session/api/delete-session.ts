import { api } from "@/shared/api/client";
export async function deleteSession(sessionId: string) {
  await api.delete(`/sessions/${sessionId}`);
}
