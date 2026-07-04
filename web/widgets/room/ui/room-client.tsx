"use client";

import { useEffect, useRef } from "react";

import { useGridLayout } from "@/shared/lib/grid/grid-layout";
import { useFullscreen } from "@/shared/lib/hooks/useFullscreen";
import { useRoomSession } from "@/features";
import { Typography } from "@/shared";

interface Props {
  userName: string;
  roomSession: ReturnType<typeof useRoomSession>;
}

export default function RoomClient({
  userName,
  roomSession,
}: Props) {
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(
    new Map(),
  );

  const localVideoRef =
    useRef<HTMLVideoElement>(null);

  const {
    stream,
    remoteVideos,
    participants,
  } = roomSession;

  const participantCount =
    1 + remoteVideos.size;

  const { layout, videoSize } =
    useGridLayout(participantCount);

  const { toggleFullscreen } =
    useFullscreen({
      autoEnterOnScreenShare: true,
    });

  useEffect(() => {
    const video = localVideoRef.current;

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

  const remoteVideosArray = Array.from(
    remoteVideos.entries(),
  );

  const badgeClassName = `
    absolute
    right-4
    bottom-4
    rounded-xl
    bg-(--room-webcam-badge)
    px-7.75
    py-3.5
    text-white
  `;

  return (
    <div className="h-full w-full">
      <div
        className="
          grid
          h-full
          w-full
          justify-center
          content-center
        "
        style={{
          gridTemplateColumns: `repeat(${layout.columns}, ${videoSize.width}px)`,
          gridTemplateRows: `repeat(${layout.rows}, ${videoSize.height}px)`,
          gap: "24px",
        }}
      >
        <div
          className="
            relative
            overflow-hidden
            rounded-[17px]
            shadow-lg
          "
          style={{
            width: videoSize.width,
            height: videoSize.height,
          }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="
              h-full
              w-full
              object-cover
            "
          />

          <div className={badgeClassName}>
            <Typography
              variant="caption"
              className="text-[18px]"
            >
              {userName || "You"}
            </Typography>
          </div>
        </div>

        {remoteVideosArray.map(
          ([id, remoteStream]) => (
            <div
              key={id}
              className="
                relative
                overflow-hidden
                rounded-[17px]
                shadow-lg
              "
              style={{
                width: videoSize.width,
                height: videoSize.height,
              }}
            >
              <video
                autoPlay
                playsInline
                ref={(el) => {
                  if (!el) return;

                  el.srcObject =
                    remoteStream;

                  videoRefs.current.set(
                    id,
                    el,
                  );
                }}
                className="
                  h-full
                  w-full
                  object-cover
                "
              />

              <div className={badgeClassName}>
                <Typography
                  variant="caption"
                  className="text-[18px]"
                >
                  {participants.get(id)
                    ?.userName ??
                    `User ${id.slice(0, 5)}`}
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
                  text-white
                  transition
                  hover:opacity-80
                "
                onClick={() =>
                  toggleFullscreen(
                    videoRefs.current.get(id)
                      ?.parentElement || null,
                    id,
                  )
                }
              >
                <Typography variant="caption">
                  Fullscreen
                </Typography>
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}