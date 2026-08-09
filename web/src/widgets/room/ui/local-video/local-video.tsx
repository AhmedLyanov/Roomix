"use client";

import { useEffect, useRef } from "react";
import { FullScreenIcon } from "@/src/shared/icons/24";
import { Typography } from "@/src/shared";
import { getParticipantColor } from "@/src/shared/lib/participant/get-participant-color";

interface Props {
  stream: MediaStream | null;
  userName?: string;
  userId: string;
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
  userId,
  cameraEnabled,
  avatar,
  onFullscreen,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backgroundColor = getParticipantColor(userId);

  useEffect(() => {
    if (!videoRef.current || !stream) {
      return;
    }

    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div
      id="local-video"
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
            className="absolute inset-0 flex h-full w-full flex-col items-center justify-center"
            style={{ backgroundColor }}
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
          {/* {userName} (You) */} You
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
