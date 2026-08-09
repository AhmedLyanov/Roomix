import { api } from "@/src/shared/api/client";
import { RoomMessage } from "../model/types";

export async function getRoomMessages(roomId: string): Promise<RoomMessage[]> {
  const { data } = await api.get<RoomMessage[]>(`/chat/${roomId}/messages`);

  return data;
}

export async function getRoomFiles(roomId: string): Promise<RoomMessage[]> {
  const { data } = await api.get<RoomMessage[]>(`/chat/${roomId}/files`);

  return data;
}
