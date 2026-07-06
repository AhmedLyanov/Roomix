"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useParams } from "next/navigation";

import {
  RoomControl,
  ShareLink,
  useRoomSession,
  RoomLayoutSwitcher,
} from "@/features";

import { Button } from "@/shared";

import {
  SettingsIcon,
  QuestionIcon,
  LightningIcon,
  NextIcon,
  ParticipantsIcon,
  ChatIcon,
  MagicIcon,
  RoomPluginsIcon,
} from "@/shared/icons/24";

import { RoomClient } from "@/widgets/room";

export default function RoomPage() {
  const params = useParams();

  const roomId = params.roomId as string;

  const { user, isLoaded } = useUser();

  const userName =
    user?.fullName ??
    user?.username ??
    user?.firstName ??
    user?.primaryEmailAddress?.emailAddress ??
    "Anonymous";

  const roomSession = useRoomSession({
    roomId,
    userName,
  });

  if (!isLoaded) {
    return null;
  }

  const participantCount = 1 + roomSession.remoteVideos.size;

  const roomUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleLeaveRoom = () => {
    roomSession.disconnect();
    window.location.replace("/");
  };

  return (
    <div className="flex h-screen flex-col bg-(--color-background)">
      <header className="relative border-b border-(--room-header-border)">
        <div className="flex items-center justify-between px-4.5 pl-31 pt-3.25 pb-4">
          <ShareLink link={roomUrl} />

          <div className="flex items-center gap-4">
            <Button variant="control" icon={<SettingsIcon />} />

            <Button variant="control" icon={<QuestionIcon />} />

            <Button variant="control" icon={<LightningIcon />} badge />

            <div className="h-11.25 w-11.25">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-[45px] h-[45px]",

                    userButtonAvatarBox: "w-[45px] h-[45px]",

                    userButtonTrigger:
                      "w-[45px] h-[45px] rounded-full overflow-hidden",
                  },
                }}
              />
            </div>
          </div>
        </div>

        <button
          className="
            absolute
            left-0
            bottom-0
            z-10
            flex
            w-15.75
            translate-y-1/2
            items-center
            justify-center
            bg-(--color-background)
          "
        >
          <NextIcon />
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <div className="relative h-full px-31 py-10.75">
          <RoomLayoutSwitcher />

          <div
            className="
              absolute
              top-22.5
              right-0
              z-20
              flex
              flex-col
              items-center
              justify-between
              gap-7
              rounded-l-[20px]
              bg-(--room-navigation-bg)
              px-3.5
              py-5.75
            "
          >
            <button className="flex items-center gap-px text-(--color-gray-light)">
              <ParticipantsIcon />

              <span className="text-[14px] leading-none">
                {participantCount}
              </span>
            </button>

            <button className="text-(--color-gray-light)">
              <ChatIcon />
            </button>

            <button className="text-(--color-gray-light)">
              <MagicIcon />
            </button>

            <button className="text-(--color-gray-light)">
              <RoomPluginsIcon />
            </button>
          </div>

          <main className="h-full">
            <RoomClient roomSession={roomSession} userName={userName} />
          </main>
        </div>
      </div>

      <RoomControl
        isCameraOn={roomSession.isCameraOn}
        isMicOn={roomSession.isMicOn}
        isScreenSharing={roomSession.isScreenSharing}
        onToggleCamera={roomSession.toggleCamera}
        onToggleMic={roomSession.toggleMic}
        onToggleScreenShare={roomSession.toggleScreenShare}
        onLeaveRoom={handleLeaveRoom}
      />
    </div>
  );
}
