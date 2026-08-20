"use client";

import { useEffect, useCallback, useState } from "react";

import type { UseRoomSessionProps } from "../model/types";
import { useSubtitles } from "../hooks/use-subtitles";
import { useMediaControls } from "../hooks/use-media-controls";
import { useMedia } from "../hooks/use-media";
import { usePeer } from "../hooks/use-peer";
import { useSocket } from "../hooks/use-socket";

import type { RoomMessage } from "@/src/entities/message";

export function useRoomSession({
  roomId,
  userId,
  userName,
  userAvatar,
  nativeLanguage,
}: UseRoomSessionProps) {
  const { stream, stopStream } = useMedia();

  const { subtitles, setSubtitle, clearSubtitles } = useSubtitles();

  const [messages, setMessages] = useState<RoomMessage[]>([]);

  const {
    peersRef,
    remoteVideos,
    createPeer,
    removePeer,
    destroyAllPeers,
    setOnSignal,
  } = usePeer(stream);

  const handleChatMessage = useCallback((message: RoomMessage) => {
    setMessages((prev) => {
      // Защита от дублей.
      if (prev.some((item) => item._id === message._id)) {
        return prev;
      }

      return [...prev, message];
    });
  }, []);

  const {
    audioSenderRef,
    socketRef,
    socketId,
    participants,
    handleSignal,
    disconnectSocket,
    sendMessage,
    updateLanguage,
    updateCamera,
    updateMicrophone,
  } = useSocket({
    roomId,
    userId,
    userName,
    userAvatar,
    nativeLanguage,
    stream,
    peersRef,
    createPeer,
    removePeer,
    setSubtitle,
    setMessage: handleChatMessage,
  });

  useEffect(() => {
    setOnSignal(handleSignal);
  }, [handleSignal, setOnSignal]);

  const {
    isCameraOn,
    isMicOn,
    isTranslationEnabled,
    isScreenSharing,
    toggleCamera,
    toggleMic,
    toggleTranslation,
    toggleScreenShare,
  } = useMediaControls({
    stream,
    audioSenderRef,
    onCameraChange: updateCamera,
    onMicrophoneChange: updateMicrophone,
  });

  const disconnect = useCallback(() => {
    disconnectSocket();
    destroyAllPeers();
    stopStream();
    clearSubtitles();
    setMessages([]);
  }, [disconnectSocket, destroyAllPeers, stopStream, clearSubtitles]);

  return {
    stream,
    remoteVideos,
    participants,
    subtitles,
    messages,

    socketId,
    socketRef,

    sendMessage,
    updateLanguage,

    isCameraOn,
    isMicOn,
    isTranslationEnabled,
    isScreenSharing,

    toggleCamera,
    toggleMic,
    toggleTranslation,
    toggleScreenShare,

    disconnect,
  };
}
