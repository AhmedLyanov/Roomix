"use client";

import { useState } from "react";

import {
  MicroIcon,
  SoundOnIcon,
  WebCameraIcon,
  CloseMeetIcon,
  ShareVideoIcon,
  StartRecordIcon,
  SmileIcon,
  LanguageIcon,
} from "@/src/shared/icons/24";

import { Button } from "@/src/shared";

const LANGUAGES = [
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
];

interface RoomControlProps {
  isCameraOn: boolean;
  isMicOn: boolean;
  isTranslationEnabled: boolean;
  isScreenSharing: boolean;

  nativeLanguage: string;

  onLanguageChange: (language: string) => void;

  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleTranslation: () => void;
  onToggleScreenShare: () => void;
  onLeaveRoom: () => void;
}

export function RoomControl({
  isCameraOn,
  isMicOn,
  isTranslationEnabled,
  isScreenSharing,

  nativeLanguage,

  onLanguageChange,

  onToggleCamera,
  onToggleMic,
  onToggleTranslation,
  onToggleScreenShare,
  onLeaveRoom,
}: RoomControlProps) {
  const [translationOpen, setTranslationOpen] = useState(false);

  return (
    <div className="flex h-20 items-center justify-center bg-(--room-control-primary)">
      <div className="flex items-center gap-7.5">
        <Button
          variant="control"
          icon={<MicroIcon />}
          onClick={onToggleMic}
          className={!isMicOn ? "opacity-50" : ""}
        />

        <div className="relative">
          <Button
            variant="control"
            icon={<LanguageIcon />}
            onClick={() => {
              onToggleTranslation();
              setTranslationOpen((prev) => !prev);
            }}
            className={
              isTranslationEnabled
                ? "bg-(--color-accent)/20 text-(--color-accent)"
                : ""
            }
          />

          {translationOpen && (
            <div
              className="
      absolute
      bottom-16
      left-1/2
      z-50
      w-52
      -translate-x-1/2

      rounded-2xl
      border
      border-(--color-border-strong)

      bg-(--room-navigation-bg)/95
      p-3

      shadow-[0_12px_40px_rgba(0,0,0,0.35)]
      backdrop-blur-xl

      animate-in
      fade-in
      slide-in-from-bottom-2
      duration-200
    "
            >
              <div
                className="
        mb-3
        px-2
        text-xs
        font-medium
        tracking-wide
        text-(--color-gray)
      "
              >
                Язык перевода
              </div>

              <div className="flex flex-col gap-1">
                {LANGUAGES.map((language) => (
                  <button
                    key={language.code}
                    onClick={() => {
                      onLanguageChange(language.code);
                      setTranslationOpen(false);
                    }}

                    className={`
            flex
            items-center
            justify-between

            rounded-xl
            px-3
            py-2.5

            text-sm
            transition-all
            duration-200

            ${
              nativeLanguage === language.code
                ? `
                  bg-(--color-accent)
                  text-white
                `
                : `
                  text-(--color-foreground)
                  hover:bg-(--plugin-item-bg-hover)
                `
            }
          `}
                  >
                    <span>{language.label}</span>

                    {nativeLanguage === language.code && (
                      <span
                        className="
                text-xs
                opacity-80
              "
                      >
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

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
