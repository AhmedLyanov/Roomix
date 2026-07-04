"use client";

import { useEffect, useRef } from "react";
import { useGridLayout } from "@/shared/lib/grid/gridLayout";
import { useFullscreen } from "@/shared/lib/hooks/useFullscreen";
import { useRoomSession } from "@/features";

interface Props {
  userName: string;
  roomSession: ReturnType<typeof useRoomSession>;
}

export default function RoomClient({
  userName,
  roomSession,
}: Props) {
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const {
    stream,
    remoteVideos,
    participants,
  } = roomSession;

  const participantCount = 1 + remoteVideos.size;

  const { layout, videoSize } = useGridLayout(
    gridRef,
    participantCount,
  );

  const { toggleFullscreen } = useFullscreen({
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

  return (
    <div className="h-full">
      <div
        ref={gridRef}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
          width: "100%",
          height: "100%",
          gap: "16px",
        }}
      >
        <div
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
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          <div>{userName || "You"}</div>
        </div>

        {remoteVideosArray.map(
          ([id, remoteStream]) => (
            <div
              key={id}
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

                  el.srcObject = remoteStream;

                  videoRefs.current.set(id, el);
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />

              <div>
                {participants.get(id)?.userName ??
                  `User ${id.slice(0, 5)}`}
              </div>

              <button
                onClick={() =>
                  toggleFullscreen(
                    videoRefs.current.get(id)
                      ?.parentElement || null,
                    id,
                  )
                }
              >
                Fullscreen
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}