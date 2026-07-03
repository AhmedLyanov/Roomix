"use client";

import {
  MicroIcon,
  SoundOnIcon,
  WebCameraIcon,
  CloseMeetIcon,
  ShareVideoIcon,
  StartRecordIcon,
  SmileIcon,
} from "@/shared/icons/24";

interface RoomControlProps {
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleScreenShare: () => void;
  onLeaveRoom: () => void;
}

export function RoomControl({
  isCameraOn,
  isMicOn,
  isScreenSharing,
  onToggleCamera,
  onToggleMic,
  onToggleScreenShare,
  onLeaveRoom,
}: RoomControlProps) {
  return (
    <div className="flex justify-center items-center h-20 bg-(--room-control-primary)">
      <div className="flex items-center gap-7.5">
        <button
          onClick={onToggleMic}
          className={`opacity-${isMicOn ? "100" : "50"} transition-opacity`}
          title={isMicOn ? "Mic on" : "Mic off"}
        >
          <MicroIcon />
        </button>

        <SoundOnIcon />

        <button
          onClick={onToggleCamera}
          className={`opacity-${isCameraOn ? "100" : "50"} transition-opacity`}
          title={isCameraOn ? "Camera on" : "Camera off"}
        >
          <WebCameraIcon />
        </button>

        <button
          onClick={onLeaveRoom}
          className="
            flex items-center justify-center
            w-16 h-16
            px-3.5
            py-5.5
            rounded-[17px]
            bg-(--color-close-conference)
            hover:opacity-90
            transition-opacity
          "
          title="Leave room"
        >
          <CloseMeetIcon />
        </button>

        <button
          onClick={onToggleScreenShare}
          className={`opacity-${isScreenSharing ? "100" : "50"} transition-opacity`}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          <ShareVideoIcon />
        </button>

        <StartRecordIcon />

        <SmileIcon />
      </div>
    </div>
  );
}
