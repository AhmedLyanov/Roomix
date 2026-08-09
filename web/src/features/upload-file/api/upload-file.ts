import { api } from "@/src/shared/api/client";
import type { RoomMessage } from "@/src/entities/message";

interface UploadFileParams {
  roomId: string;
  file: File;
  onProgress?: (progress: number) => void;
}

export async function uploadFile({
  roomId,
  file,
  onProgress,
}: UploadFileParams): Promise<RoomMessage> {
  const formData = new FormData();

  formData.append("file", file);

  const { data } = await api.post<RoomMessage>(
    `/chat/${roomId}/files`,
    formData,
    {
      onUploadProgress: (event) => {
        if (!event.total) return;

        const progress = Math.round((event.loaded / event.total) * 100);

        onProgress?.(progress);
      },
    },
  );

  return data;
}
