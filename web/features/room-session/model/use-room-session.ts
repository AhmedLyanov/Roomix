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
  userAvatar,
  nativeLanguage,
}: UseRoomSessionProps) {
  const { stream, stopStream } = useMedia();

  const { subtitles, setSubtitle, clearSubtitles } = useSubtitles();

  const {
    peersRef,
    remoteVideos,
    createPeer,
    removePeer,
    destroyAllPeers,
    setOnSignal,
  } = usePeer(stream);

  const {
    audioSenderRef,
    socketRef,
    socketId,
    participants,
    handleSignal,
    disconnectSocket,
    sendMessage,
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
  } = useMediaControls({ stream, audioSenderRef });

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
    socketRef,
    sendMessage,

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
