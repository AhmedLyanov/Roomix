"use client";

import { useRef, useState } from "react";

import { SendBinaryFiles } from "@/shared/icons/24";
import { uploadFile } from "../api/upload-file";

interface Props {
  roomId: string;
}

export function UploadFileButton({ roomId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSelectFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setUploading(true);
      setProgress(0);

      await uploadFile({
        roomId,
        file,
        onProgress: setProgress,
      });
    } catch (error) {
      console.error("Failed to upload file:", error);
    } finally {
      setUploading(false);
      setProgress(0);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleSelectFile}
        disabled={uploading}
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="relative"
      >
        <SendBinaryFiles />

        {uploading && (
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs">
            {progress}%
          </span>
        )}
      </button>
    </>
  );
}
