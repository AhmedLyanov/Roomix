"use client";

import {
  MicroIcon,
  SoundOnIcon,
  WebCameraIcon,
  CloseMeetIcon,
  ShareVideoIcon,
  StartRecordIcon,
  SmileIcon,
  LanguageIcon,
} from "@/shared/icons/24";

import { Button } from "@/shared";

const LANGUAGES = [
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
];

interface RoomControlProps {
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing: boolean;
  nativeLanguage: string;
  onLanguageChange: (language: string) => void;

  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleScreenShare: () => void;
  onLeaveRoom: () => void;
}

export function RoomControl({
  isCameraOn,
  isMicOn,
  isScreenSharing,
  nativeLanguage,
  onLanguageChange,
  onToggleCamera,
  onToggleMic,
  onToggleScreenShare,
  onLeaveRoom,
}: RoomControlProps) {
  return (
    <div className="flex h-20 items-center justify-center bg-(--room-control-primary)">
      <div className="flex items-center gap-7.5">
        <div className="flex items-center gap-2">
          <LanguageIcon className="text-(--color-gray-light)" />
          <select
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600"
            value={nativeLanguage}
            onChange={(e) => onLanguageChange(e.target.value)}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="control"
          icon={<MicroIcon />}
          onClick={onToggleMic}
          className={!isMicOn ? "opacity-50" : ""}
        />

        <Button variant="control" icon={<SoundOnIcon />} />

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

        <Button variant="control" icon={<StartRecordIcon />} />

        <Button variant="control" icon={<SmileIcon />} />
      </div>
    </div>
  );
}
