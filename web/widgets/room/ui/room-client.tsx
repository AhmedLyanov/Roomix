"use client";

import { useGridLayout } from "@/shared/lib/grid/grid-layout";
import { useFullscreen } from "@/shared/lib/hooks/use-full-screen";
import { useRoomSession } from "@/features";
import { LocalVideoCard } from "./local-video/local-video";
import { RemoteVideoCard } from "./remote-video/remote-video";

interface Props {
  userName: string;
  roomSession: ReturnType<typeof useRoomSession>;
}

export default function RoomClient({ userName, roomSession }: Props) {
  const { stream, remoteVideos, participants } = roomSession;

  const participantCount = 1 + remoteVideos.size;

  const { layout, videoSize } = useGridLayout(participantCount);

  const { toggleFullscreen } = useFullscreen({
    autoEnterOnScreenShare: true,
  });

  const remoteVideosArray = Array.from(remoteVideos.entries());

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
        <LocalVideoCard
          stream={stream}
          userName={userName}
          width={videoSize.width}
          height={videoSize.height}
        />

        {remoteVideosArray.map(([id, remoteStream]) => (
          <RemoteVideoCard
            key={id}
            stream={remoteStream}
            width={videoSize.width}
            height={videoSize.height}
            userName={
              participants.get(id)?.userName ?? `User ${id.slice(0, 5)}`
            }
            onFullscreen={() =>
              toggleFullscreen(document.getElementById(`video-${id}`), id)
            }
          />
        ))}
      </div>
    </div>
  );
}
