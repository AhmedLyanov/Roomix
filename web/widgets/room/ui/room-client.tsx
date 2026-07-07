"use client";

import { useGridLayout } from "@/shared/lib/grid/grid-layout";

import { useRoomLayoutStore } from "@/shared/model/room-client.store";

import { useFullscreen } from "@/shared/lib/hooks/use-full-screen";
import { useRoomSession } from "@/features";

import { LocalVideoCard } from "./local-video/local-video";
import { RemoteVideoCard } from "./remote-video/remote-video";

interface Props {
  userName?: string;
  roomSession: ReturnType<typeof useRoomSession>;
}

export default function RoomClient({ userName, roomSession }: Props) {
  const { stream, remoteVideos, participants } = roomSession;

  const { layoutMode } = useRoomLayoutStore();

  const participantCount = 1 + remoteVideos.size;

  const { mode, grid, mainVideo, sidebarVideo } = useGridLayout(
    participantCount,
    layoutMode,
  );

  const { toggleFullscreen } = useFullscreen({
    autoEnterOnScreenShare: true,
  });

  const remoteVideosArray = Array.from(remoteVideos.entries());

  if (mode === "grid") {
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
            gridTemplateColumns: `repeat(${grid.columns}, ${mainVideo.width}px)`,

            gridTemplateRows: `repeat(${grid.rows}, ${mainVideo.height}px)`,

            gap: "24px",
          }}
        >
          <LocalVideoCard
            stream={stream}
            userName={userName}
            width={mainVideo.width}
            height={mainVideo.height}
          />

          {remoteVideosArray.map(([id, remoteStream]) => (
            <RemoteVideoCard
              key={id}
              stream={remoteStream}
              width={mainVideo.width}
              height={mainVideo.height}
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

  if (mode === "focus") {
    return (
      <div className="flex h-full justify-center gap-5">
        <div>
          <LocalVideoCard
            stream={stream}
            userName={userName}
            width={mainVideo.width}
            height={mainVideo.height}
          />
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {remoteVideosArray.map(([id, remoteStream]) => (
            <RemoteVideoCard
              key={id}
              stream={remoteStream}
              width={sidebarVideo?.width ?? 220}
              height={sidebarVideo?.height ?? 124}
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

  return (
    <div className="flex h-full items-center justify-center">
      <LocalVideoCard
        stream={stream}
        userName={userName}
        width={mainVideo.width}
        height={mainVideo.height}
      />
    </div>
  );
}
