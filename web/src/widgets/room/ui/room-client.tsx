"use client";

import { useEffect, useState } from "react";
import { useGridLayout } from "@/src/shared/lib/grid/grid-layout";
import { useRoomLayoutStore } from "@/src/shared/model/room-client.store";
import { useFullscreen } from "@/src/shared/lib/hooks/use-full-screen";

import { useRoomSession } from "@/src/features";

import { LocalVideoCard } from "./local-video/local-video";
import { RemoteVideoCard } from "./remote-video/remote-video";

interface SubtitleBubbleProps {
  subtitle: {
    originalText: string;
    translatedText: string;
  } | null;
}

function SubtitleBubble({ subtitle }: SubtitleBubbleProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!subtitle) return null;

  return (
    <div
      className={`
        absolute bottom-4 left-1/2 z-30 w-full max-w-[88%] -translate-x-1/2
        pointer-events-none
        transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}
      `}
    >
      <div
        className="
          rounded-2xl
          border
          border-[var(--color-border-strong)]
          bg-[var(--room-navigation-bg)]/95
          px-4
          py-3
          shadow-[0_8px_32px_rgba(0,0,0,0.4)]
          backdrop-blur-xl
        "
      >
        <div className="text-[11px] leading-tight tracking-wide text-[var(--color-gray)] line-clamp-1">
          {subtitle.originalText}
        </div>
        <div className="mt-1 text-[13px] leading-snug font-medium text-[var(--color-foreground)] line-clamp-2">
          {subtitle.translatedText}
        </div>
      </div>
    </div>
  );
}

interface Props {
  userName?: string;
  userAvatar?: string;
  roomSession: ReturnType<typeof useRoomSession>;
}

export default function RoomClient({
  userName,
  userAvatar,
  roomSession,
}: Props) {
  const {
    stream,
    remoteVideos,
    participants,
    subtitles,
    socketId,
    isCameraOn,
  } = roomSession;

  const { layoutMode } = useRoomLayoutStore();

  const participantCount = 1 + remoteVideos.size;

  const { mode, grid, mainVideo, sidebarVideo } = useGridLayout(
    participantCount,
    layoutMode,
  );

  const { toggleFullscreen } = useFullscreen();

  const remoteVideosArray = Array.from(remoteVideos.entries());

  const localSubtitle = socketId ? (subtitles.get(socketId) ?? null) : null;

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
          <div className="relative">
            <LocalVideoCard
              stream={stream}
              userName={userName}
              width={mainVideo.width}
              height={mainVideo.height}
              userId={participants.get(socketId)?.userId ?? socketId}
              avatar={userAvatar}
              cameraEnabled={isCameraOn ?? true}
              onFullscreen={() =>
                toggleFullscreen(
                  document.getElementById("local-video"),
                  "local",
                )
              }
            />
            <SubtitleBubble
              key={
                localSubtitle
                  ? `${localSubtitle.originalText}-${localSubtitle.translatedText}`
                  : "local"
              }
              subtitle={localSubtitle}
            />
          </div>

          {remoteVideosArray.map(([id, remoteStream]) => {
            const remoteSubtitle = subtitles.get(id) ?? null;
            return (
              <div key={id} className="relative">
                <RemoteVideoCard
                  stream={remoteStream}
                  width={mainVideo.width}
                  height={mainVideo.height}
                  userName={
                    participants.get(id)?.userName ?? `User ${id.slice(0, 5)}`
                  }
                  avatar={participants.get(id)?.userAvatar}
                  cameraEnabled={participants.get(id)?.cameraEnabled ?? true}
                  microphoneEnabled={
                    participants.get(id)?.microphoneEnabled ?? true
                  }
                  userId={participants.get(id)?.userId ?? id}
                  onFullscreen={() =>
                    toggleFullscreen(document.getElementById(`video-${id}`), id)
                  }
                />
                <SubtitleBubble
                  key={
                    remoteSubtitle
                      ? `${remoteSubtitle.originalText}-${remoteSubtitle.translatedText}`
                      : id
                  }
                  subtitle={remoteSubtitle}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (mode === "focus") {
    return (
      <div
        className="
          flex
          h-full
          justify-center
          gap-5
        "
      >
        <div className="relative">
          <LocalVideoCard
            stream={stream}
            userName={userName}
            width={mainVideo.width}
            height={mainVideo.height}
            avatar={userAvatar}
            userId={participants.get(socketId)?.userId ?? socketId}
            cameraEnabled={isCameraOn ?? true}
            onFullscreen={() =>
              toggleFullscreen(document.getElementById("local-video"), "local")
            }
          />
          <SubtitleBubble
            key={
              localSubtitle
                ? `${localSubtitle.originalText}-${localSubtitle.translatedText}`
                : "local"
            }
            subtitle={localSubtitle}
          />
        </div>

        <div
          className="
            flex
            flex-col
            gap-4
            overflow-y-auto
          "
        >
          {remoteVideosArray.map(([id, remoteStream]) => {
            const remoteSubtitle = subtitles.get(id) ?? null;
            return (
              <div key={id} className="relative">
                <RemoteVideoCard
                  stream={remoteStream}
                  width={sidebarVideo?.width ?? 220}
                  height={sidebarVideo?.height ?? 124}
                  userName={
                    participants.get(id)?.userName ?? `User ${id.slice(0, 5)}`
                  }
                  avatar={participants.get(id)?.userAvatar}
                  cameraEnabled={participants.get(id)?.cameraEnabled ?? true}
                  microphoneEnabled={
                    participants.get(id)?.microphoneEnabled ?? true
                  }
                  userId={participants.get(id)?.userId ?? id}
                  onFullscreen={() =>
                    toggleFullscreen(document.getElementById(`video-${id}`), id)
                  }
                />
                <SubtitleBubble
                  key={
                    remoteSubtitle
                      ? `${remoteSubtitle.originalText}-${remoteSubtitle.translatedText}`
                      : id
                  }
                  subtitle={remoteSubtitle}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        flex
        h-full
        items-center
        justify-center
      "
    >
      <div className="relative">
        <LocalVideoCard
          stream={stream}
          userName={userName}
          width={mainVideo.width}
          userId={participants.get(socketId)?.userId ?? socketId}
          height={mainVideo.height}
          avatar={userAvatar}
          cameraEnabled={isCameraOn ?? true}
          onFullscreen={() =>
            toggleFullscreen(document.getElementById("local-video"), "local")
          }
        />
        <SubtitleBubble
          key={
            localSubtitle
              ? `${localSubtitle.originalText}-${localSubtitle.translatedText}`
              : "local"
          }
          subtitle={localSubtitle}
        />
      </div>
    </div>
  );
}
