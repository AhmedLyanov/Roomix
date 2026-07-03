"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRoomSession } from "@/features";
import { useGridLayout } from "@/shared/lib/grid/gridLayout";
import { useFullscreen } from "@/shared/lib/hooks/useFullscreen";

interface Props {
  roomId: string;
}

export default function RoomClient({ roomId }: Props) {
  const router = useRouter();

  const [userName, setUserName] = useState<string>("");
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const {
    stream,
    remoteVideos,
    participants,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
    disconnect,
  } = useRoomSession({ roomId, userName });

  const [participantCount, setParticipantCount] = useState(1);
  const { layout, videoSize } = useGridLayout(gridRef, participantCount);
  const { exitFullscreen, toggleFullscreen } = useFullscreen({
    autoEnterOnScreenShare: true,
  });

  useEffect(() => {
    const storedName = sessionStorage.getItem("userName");
    setUserName(storedName || `User ${Math.floor(Math.random() * 1000)}`);
  }, []);

  useEffect(() => {
    if (stream && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => setParticipantCount(1 + remoteVideos.size), [remoteVideos]);

  const handleLeaveRoom = () => {
    disconnect();
    router.push("/");
  };

  if (!userName) return <div>Loading...</div>;

  const remoteVideosArray = Array.from(remoteVideos.entries());

  return (
    <div>
      <div
        ref={gridRef}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
        }}
      >
        <div style={{ width: videoSize.width, height: videoSize.height }}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{ width: "100%", height: "100%" }}
          />
          <div>{userName || "You"}</div>
        </div>

        {remoteVideosArray.map(([id, remoteStream]) => (
          <div
            key={id}
            style={{ width: videoSize.width, height: videoSize.height }}
          >
            <video
              autoPlay
              playsInline
              ref={(el) => {
                if (el) {
                  el.srcObject = remoteStream;
                  videoRefs.current.set(id, el);
                }
              }}
              style={{ width: "100%", height: "100%" }}
            />
            <div>
              {participants.get(id)?.userName || `User ${id.slice(0, 5)}`}
            </div>
            <button
              onClick={() =>
                toggleFullscreen(
                  videoRefs.current.get(id)?.parentElement || null,
                  id,
                )
              }
            >
              Fullscreen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
