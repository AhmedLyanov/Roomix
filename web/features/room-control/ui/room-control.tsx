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

import { Button } from "@/shared";

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
    <div className="flex h-20 items-center justify-center bg-(--room-control-primary)">
      <div className="flex items-center gap-7.5">
        <Button
          variant="control"
          icon={<MicroIcon />}
          onClick={onToggleMic}
          className={!isMicOn ? "opacity-50" : ""}
        />

        <Button
          variant="control"
          icon={<SoundOnIcon />}
        />

        <Button
          variant="control"
          icon={<WebCameraIcon />}
          onClick={onToggleCamera}
          className={!isCameraOn ? "opacity-50" : ""}
        />

        <Button
          variant="danger"
          icon={<CloseMeetIcon />}
          onClick={onLeaveRoom}
          className="
            h-16
            w-16
            rounded-[17px]
            bg-(--color-close-conference)

            hover:opacity-90
          "
        />

        <Button
          variant="control"
          icon={<ShareVideoIcon />}
          onClick={onToggleScreenShare}
          className={!isScreenSharing ? "opacity-50" : ""}
        />

        <Button
          variant="control"
          icon={<StartRecordIcon />}
        />

        <Button
          variant="control"
          icon={<SmileIcon />}
        />
      </div>
    </div>
  );
}