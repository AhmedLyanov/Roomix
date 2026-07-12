"use client";

import { useEffect, useRef } from "react";
import { FullScreenIcon } from "@/shared/icons/24";
import { Typography } from "@/shared";

interface Props {
  stream: MediaStream;
  userName: string;
  width: number;
  height: number;
}

export function RemoteVideoCard({ stream, userName, width, height }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoRef.current || !stream) {
      return;
    }

    videoRef.current.srcObject = stream;
  }, [stream]);
  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
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
          {userName}
        </Typography>
      </div>

      <button
        className="
          absolute
          left-4
          bottom-4
          rounded-xl
          bg-(--room-webcam-badge)
          p-2
          transition
          hover:opacity-80
        "
        onClick={handleFullscreen}
      >
        <FullScreenIcon />
      </button>
    </div>
  );
}
