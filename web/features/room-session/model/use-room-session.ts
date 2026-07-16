// features/room-session/model/use-room-session.ts
"use client";

import { useEffect, useCallback } from "react";

import type { UseRoomSessionProps } from "../types";
import { useSubtitles } from "../hooks/use-subtitles";
import { useMediaControls } from "../hooks/use-media-controls";
import { useMedia } from "../hooks/use-media";
import { usePeer } from "../hooks/use-peer";
import { useSocket } from "../hooks/use-socket";

export function useRoomSession({
  roomId,
  userId,
  userName,
  nativeLanguage,
}: UseRoomSessionProps) {
  // 1. Медиа-поток
  const { stream, stopStream } = useMedia();

  // 2. Субтитры
  const { subtitles, setSubtitle, clearSubtitles } = useSubtitles();

  // 3. Peer соединения
  const {
    peersRef,
    remoteVideos,
    createPeer,
    removePeer,
    destroyAllPeers,
    setOnSignal,
  } = usePeer(stream);

  // 4. Socket.IO соединение
  const {
    audioSenderRef,
    socketId,
    participants,
    handleSignal,
    disconnectSocket,
  } = useSocket({
    roomId,
    userId,
    userName,
    nativeLanguage,
    stream,
    peersRef,
    createPeer,
    removePeer,
    setSubtitle,
  });

  // 5. Связываем Peer с Socket
  useEffect(() => {
    setOnSignal(handleSignal);
  }, [handleSignal, setOnSignal]);

  // 6. Управление медиа
  const {
    isCameraOn,
    isMicOn,
    isTranslationEnabled,
    isScreenSharing,
    toggleCamera,
    toggleMic,
    toggleTranslation,
    toggleScreenShare,
  } = useMediaControls({ stream, audioSenderRef });

  // 7. Полное отключение
  const disconnect = useCallback(() => {
    disconnectSocket();
    destroyAllPeers();
    stopStream();
    clearSubtitles();
  }, [disconnectSocket, destroyAllPeers, stopStream, clearSubtitles]);

  return {
    stream,
    remoteVideos,
    participants,
    subtitles,
    socketId,

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
