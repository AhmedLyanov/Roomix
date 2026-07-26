"use client";

import { useEffect, useRef } from "react";
import { FullScreenIcon } from "@/shared/icons/24";
import { Typography } from "@/shared";

interface Props {
  stream: MediaStream | null;
  userName?: string;
  width: number;
  height: number;

  cameraEnabled: boolean;
  avatar?: string;

  onFullscreen: () => void;
}

export function LocalVideoCard({
  stream,
  userName,
  width,
  height,
  cameraEnabled,
  avatar,
  onFullscreen,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current || !stream) {
      return;
    }

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
      <div className="relative h-full w-full">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`
            h-full
            w-full
            object-cover
            ${cameraEnabled ? "block" : "hidden"}
          `}
        />

        {!cameraEnabled && (
          <div
            className="
              absolute
              inset-0
              flex
              flex-col
              items-center
              justify-center
              bg-[#243B6B]
            "
          >
            {avatar ? (
              <img
                src={avatar}
                alt={userName}
                className="mb-4 h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div
                className="
                  mb-4
                  flex
                  h-24
                  w-24
                  items-center
                  justify-center
                  rounded-full
                  bg-white/15
                  text-3xl
                  font-semibold
                  text-white
                "
              >
                {userName?.[0]?.toUpperCase()}
              </div>
            )}

            <Typography variant="caption" className="text-lg text-white">
              {userName ?? "Anonymous"}
            </Typography>
          </div>
        )}
      </div>

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
        onClick={onFullscreen}
      >
        <FullScreenIcon />
      </button>
    </div>
  );
}
