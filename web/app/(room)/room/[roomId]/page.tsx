"use client";

import { useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { useParams } from "next/navigation";

import { ShareLink, useRoomSession, RoomLayoutSwitcher } from "@/src/features";
import { RoomSidebar, RoomControl } from "@/src/widgets/room/";
import { Button } from "@/src/shared";

import {
  SettingsIcon,
  QuestionIcon,
  LightningIcon,
  NextIcon,
} from "@/src/shared/icons/24";

import { RoomClient } from "@/src/widgets/room";

export default function RoomPage() {
  // console.count("RoomPage");
  const params = useParams();
  const roomId = params.roomId as string;
  const { user, isLoaded } = useUser();

  const [nativeLanguage, setNativeLanguage] = useState("ru");

  const userId = isLoaded ? user?.id : undefined;
  const userName = isLoaded
    ? (user?.fullName ??
      user?.username ??
      user?.firstName ??
      user?.primaryEmailAddress?.emailAddress)
    : undefined;

  const userAvatar = isLoaded ? user?.imageUrl : undefined;

  const roomSession = useRoomSession({
    roomId,
    userId,
    userName,
    userAvatar,

    nativeLanguage,
  });

  if (!isLoaded || !user) {
    return null;
  }

  const participantCount = 1 + roomSession.remoteVideos.size;
  const roomUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleLeaveRoom = () => {
    roomSession.disconnect();
    window.location.replace("/");
  };

  const handleParticipantsClick = () => {
    console.log("Open participants list");
  };

  const handleMagicClick = () => {
    console.log("Open magic panel");
  };

  const handlePluginsClick = () => {
    console.log("Open plugins");
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

          <RoomSidebar
            roomId={roomId}
            participantCount={participantCount}
            roomSession={roomSession}

            onParticipantsClick={handleParticipantsClick}
            onMagicClick={handleMagicClick}
            onPluginsClick={handlePluginsClick}
          />

          <main className="h-full">
            <RoomClient
              roomSession={roomSession}
              userName={userName}
              userAvatar={userAvatar}
            />
          </main>
        </div>
      </div>

      <RoomControl
        isCameraOn={roomSession.isCameraOn}
        isMicOn={roomSession.isMicOn}
        isTranslationEnabled={roomSession.isTranslationEnabled}
        isScreenSharing={roomSession.isScreenSharing}
        nativeLanguage={nativeLanguage}
        onLanguageChange={(language) => {
          setNativeLanguage(language);
          roomSession.updateLanguage(language);
        }}
        onToggleCamera={roomSession.toggleCamera}
        onToggleMic={roomSession.toggleMic}
        onToggleTranslation={roomSession.toggleTranslation}
        onToggleScreenShare={roomSession.toggleScreenShare}
        onLeaveRoom={handleLeaveRoom}
      />
    </div>
  );
}
