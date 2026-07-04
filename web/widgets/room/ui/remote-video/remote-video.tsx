"use client";

import { useEffect, useRef } from "react";

import { Typography } from "@/shared";

interface Props {
  stream: MediaStream;
  userName: string;
  width: number;
  height: number;
  onFullscreen: () => void;
}

export function RemoteVideoCard({
  stream,
  userName,
  width,
  height,
  onFullscreen,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    videoRef.current.srcObject = stream;
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
        <Typography
          variant="caption"
          className="text-[18px]"
        >
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
          px-5
          py-3
          transition
          hover:opacity-80
        "
        onClick={onFullscreen}
      >
        <Typography variant="caption">
          Fullscreen
        </Typography>
      </button>
    </div>
  );
}