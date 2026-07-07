"use client";

import { useEffect, useRef } from "react";
import { Typography } from "@/shared";

interface Props {
  stream: MediaStream | null;
  userName?: string;
  width: number;
  height: number;
}

export function LocalVideoCard({ stream, userName, width, height }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    if (stream) {
      video.srcObject = stream;
    }

    return () => {
      video.pause();
      video.srcObject = null;
      video.load();
    };
  }, [stream]);

  return (
    <div
      className="
        relative
        overflow-hidden
        rounded-[17px]
        shadow-lg
      "
      style={{
        width,
        height,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="
          h-full
          w-full
          object-cover
        "
      />

      <div
        className="
          absolute
          right-4
          bottom-4
          rounded-xl
          bg-(--room-webcam-badge)
          px-7.75
          py-3.5
        "
      >
        <Typography variant="caption" className="text-[18px]">
          {userName ?? "Anonymous"}
        </Typography>
      </div>
    </div>
  );
}
