"use client";

import { useState, useCallback } from "react";
import type { AudioSender } from "@/features/audio-sender";

interface UseMediaControlsProps {
  stream: MediaStream | null;
  audioSenderRef: React.MutableRefObject<AudioSender | null>;
}

export function useMediaControls({
  stream,
  audioSenderRef,
}: UseMediaControlsProps) {
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const toggleTranslation = useCallback(() => {
    setIsTranslationEnabled((prev) => {
      const enabled = !prev;
      audioSenderRef.current?.setTranslationEnabled(enabled);
      return enabled;
    });
  }, [audioSenderRef]);

  const toggleCamera = useCallback(() => {
    if (!stream) return;

    setIsCameraOn((prev) => {
      const enabled = !prev;
      stream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
      return enabled;
    });
  }, [stream]);

  const toggleMic = useCallback(() => {
    if (!stream) return;

    setIsMicOn((prev) => {
      const enabled = !prev;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
      audioSenderRef.current?.setMicEnabled(enabled);
      return enabled;
    });
  }, [stream, audioSenderRef]);

  const toggleScreenShare = useCallback(() => {}, []);

  return {
    isCameraOn,
    isMicOn,
    isTranslationEnabled,
    isScreenSharing,
    toggleCamera,
    toggleMic,
    toggleTranslation,
    toggleScreenShare,
  };
}
