"use client";

import { useEffect, useRef, useState } from "react";
import { FullScreenIcon, MicroOffIcon, WebOffIcon } from "@/shared/icons/24";
import { Typography } from "@/shared";
import { getParticipantColor } from "@/shared/lib/participant/get-participant-color";

interface Props {
  userId: string;
  stream: MediaStream;
  userName: string;
  width: number;
  height: number;

  cameraEnabled: boolean;
  microphoneEnabled: boolean;

  avatar?: string;

  onFullscreen: () => void;
}

export function RemoteVideoCard({
  stream,
  userName,
  width,
  height,
  userId,
  cameraEnabled,
  microphoneEnabled,
  avatar,
  onFullscreen,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [imageError, setImageError] = useState(false);
  const backgroundColor = getParticipantColor(userId);

  useEffect(() => {
    if (!videoRef.current || !stream) {
      return;
    }

    videoRef.current.srcObject = stream;
  }, [stream]);

  const handleImageError = () => {
    console.error("[RemoteVideoCard] Failed to load avatar image:", avatar);
    setImageError(true);
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name[0]?.toUpperCase() || "?";
  };

  const showMicrophoneIcon = !microphoneEnabled;
  const showCameraIcon = !cameraEnabled;
  const hasIcons = showMicrophoneIcon || showCameraIcon;

  return (
    <div
      id={`video-${userId}`}
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
              h-full
              w-full
              flex-col
              items-center
              justify-center
            "
            style={{
              backgroundColor,
            }}
          >
            {avatar && !imageError ? (
              <img
                src={avatar}
                alt={userName}
                className="mb-4 h-24 w-24 rounded-full object-cover"
                onError={handleImageError}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
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
                {getInitials(userName)}
              </div>
            )}

            <Typography variant="caption" className="text-lg text-white">
              {userName}
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
          flex
          items-center
        "
      >
        {hasIcons && (
          <div className="flex gap-3 items-center mr-4">
            {showMicrophoneIcon && <MicroOffIcon />}
            {showCameraIcon && <WebOffIcon />}
          </div>
        )}
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
        onClick={onFullscreen}
      >
        <FullScreenIcon />
      </button>
    </div>
  );
}
