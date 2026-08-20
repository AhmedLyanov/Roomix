"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";

import { AudioSender } from "@/src/features/audio-sender";

import type {
  SubtitlePayload,
  ExistingUsersPayload,
  OfferPayload,
  AnswerPayload,
  IceCandidatePayload,
  UserConnectedPayload,
  UserDisconnectedPayload,
  JoinRoomPayload,
  Participant,
  SignalData,
  MicrophoneUpdatePayload,
} from "../model/types";

import type { RoomMessage } from "@/src/entities/message";

interface UseSocketProps {
  roomId: string;
  userId: string | undefined;
  userName: string | undefined;
  userAvatar: string | undefined;
  nativeLanguage: string;
  stream: MediaStream | null;
  peersRef: React.MutableRefObject<Map<string, Peer.Instance>>;
  createPeer: (socketId: string, initiator: boolean) => Peer.Instance | null;
  removePeer: (socketId: string) => void;
  setSubtitle: (data: SubtitlePayload) => void;
  setMessage: (message: RoomMessage) => void;
}

export function useSocket({
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
  setMessage,
}: UseSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const audioSenderRef = useRef<AudioSender | null>(null);

  const streamRef = useRef<MediaStream | null>(stream);

  const [socketId, setSocketId] = useState("");
  const [participants, setParticipants] = useState<Map<string, Participant>>(
    new Map(),
  );

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !socket.connected || !stream) {
      return;
    }

    if (audioSenderRef.current) {
      audioSenderRef.current.stop();
      audioSenderRef.current = null;
    }

    audioSenderRef.current = new AudioSender(socket);
    audioSenderRef.current.start(stream);
    audioSenderRef.current.setTranslationEnabled(false);

    return () => {
      audioSenderRef.current?.stop();
      audioSenderRef.current = null;
    };
  }, [stream]);

  const handleSignal = useCallback((signal: SignalData) => {
    const socket = socketRef.current;

    if (!socket) {
      console.warn("[Socket] Signal ignored: socket is null");
      return;
    }

    if (!socket.connected) {
      console.warn("[Socket] Signal ignored: socket is disconnected");
      return;
    }

    switch (signal.type) {
      case "offer":
        socket.emit("offer", {
          offer: signal.data,
          to: signal.to,
        });
        break;

      case "answer":
        socket.emit("answer", {
          answer: signal.data,
          to: signal.to,
        });
        break;

      case "ice-candidate":
        socket.emit("ice-candidate", {
          candidate: signal.data,
          to: signal.to,
        });
        break;
    }
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const socket = socketRef.current;

      if (!socket) {
        console.warn("[Socket] Cannot send message: socket is null");
        return;
      }

      if (!socket.connected) {
        console.warn("[Socket] Cannot send message: socket disconnected");
        return;
      }

      const value = text.trim();

      if (!value) {
        return;
      }

      socket.emit("chat:send", {
        roomId,
        senderId: userId,
        senderName: userName,
        senderAvatar: userAvatar,
        text: value,
      });
    },
    [roomId, userId, userName, userAvatar],
  );

  const updateLanguage = useCallback(
    (language: string) => {
      socketRef.current?.emit("language:update", {
        roomId,
        userId,
        language,
      });
    },
    [roomId, userId],
  );

  const updateCamera = useCallback(
    (enabled: boolean) => {
      socketRef.current?.emit("camera:update", {
        roomId,
        userId,
        enabled,
      });
    },
    [roomId, userId],
  );

  const updateMicrophone = useCallback(
    (enabled: boolean) => {
      socketRef.current?.emit("mic:update", {
        roomId,
        userId,
        enabled,
      });
    },
    [roomId, userId],
  );

  useEffect(() => {
    if (!userId || !userName) {
      return;
    }

    const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL;

    if (!signalingUrl) {
      console.error("[Socket] NEXT_PUBLIC_SIGNALING_URL is not defined");
      return;
    }

    const socket = io(signalingUrl, {
      path: "/ws",
      transports: ["websocket"],
      forceNew: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setSocketId(socket.id ?? "");

      const currentStream = streamRef.current;

      if (currentStream && !audioSenderRef.current) {
        audioSenderRef.current = new AudioSender(socket);
        audioSenderRef.current.start(currentStream);
        audioSenderRef.current.setTranslationEnabled(false);
      }

      const payload: JoinRoomPayload = {
        roomId,
        userId,
        userName,
        nativeLanguage,
        userAvatar,
      };

      socket.emit("join-room", payload);
    };

    const handleConnectError = (error: Error) => {
      console.error("[Socket] Connection error:", error);
    };

    const handleNewMessage = (message: RoomMessage) => {
      setMessage(message);
    };

    const handleSubtitle = (data: SubtitlePayload) => {
      setSubtitle(data);
    };

    const handleExistingUsers = ({ users }: ExistingUsersPayload) => {
      users.forEach(
        ({
          socketId: remoteSocketId,
          userName: remoteUserName,
          userAvatar: remoteUserAvatar,
          cameraEnabled,
          microphoneEnabled,
        }) => {
          if (remoteSocketId === socket.id) {
            return;
          }

          setParticipants((prev) => {
            const next = new Map(prev);

            next.set(remoteSocketId, {
              userId: "",
              userName: remoteUserName,
              userAvatar: remoteUserAvatar,
              cameraEnabled,
              microphoneEnabled,
            });

            return next;
          });

          createPeer(remoteSocketId, true);
        },
      );
    };

    const handleUserConnected = ({
      socketId: remoteSocketId,
      userName: remoteUserName,
      userAvatar: remoteUserAvatar,
      cameraEnabled,
      microphoneEnabled,
    }: UserConnectedPayload) => {
      if (remoteSocketId === socket.id) {
        return;
      }

      setParticipants((prev) => {
        const next = new Map(prev);

        next.set(remoteSocketId, {
          userId: "",
          userName: remoteUserName,
          userAvatar: remoteUserAvatar,
          cameraEnabled,
          microphoneEnabled,
        });

        return next;
      });

      createPeer(remoteSocketId, false);
    };

    const handleOffer = ({ offer, from }: OfferPayload) => {
      let peer = peersRef.current.get(from);

      if (!peer) {
        const createdPeer = createPeer(from, false);

        if (!createdPeer) {
          console.error("[Socket] Cannot create peer for offer:", from);
          return;
        }

        peer = createdPeer;
      }

      peer.signal(offer);
    };

    const handleAnswer = ({ answer, from }: AnswerPayload) => {
      const peer = peersRef.current.get(from);

      if (!peer) {
        console.warn("[Socket] Peer not found for answer:", from);
        return;
      }

      peer.signal(answer);
    };

    const handleIceCandidate = ({ candidate, from }: IceCandidatePayload) => {
      const peer = peersRef.current.get(from);

      if (!peer) {
        console.warn("[Socket] Peer not found for ICE:", from);
        return;
      }

      peer.signal(candidate);
    };

    const handleCameraUpdate = ({
      socketId: remoteSocketId,
      enabled,
    }: {
      socketId: string;
      enabled: boolean;
    }) => {
      setParticipants((prev) => {
        const next = new Map(prev);

        const participant = next.get(remoteSocketId);

        if (!participant) {
          return prev;
        }

        next.set(remoteSocketId, {
          ...participant,
          cameraEnabled: enabled,
        });

        return next;
      });
    };

    const handleMicUpdate = ({
      socketId: remoteSocketId,
      enabled,
    }: MicrophoneUpdatePayload) => {
      setParticipants((prev) => {
        const next = new Map(prev);

        const participant = next.get(remoteSocketId);

        if (!participant) {
          return prev;
        }

        next.set(remoteSocketId, {
          ...participant,
          microphoneEnabled: enabled,
        });

        return next;
      });
    };

    const handleUserDisconnected = ({
      socketId: remoteSocketId,
    }: UserDisconnectedPayload) => {
      removePeer(remoteSocketId);

      setParticipants((prev) => {
        const next = new Map(prev);

        next.delete(remoteSocketId);

        return next;
      });
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("chat:new", handleNewMessage);
    socket.on("subtitle", handleSubtitle);
    socket.on("existing-users", handleExistingUsers);
    socket.on("user-connected", handleUserConnected);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("camera:update", handleCameraUpdate);
    socket.on("mic:update", handleMicUpdate);
    socket.on("user-disconnected", handleUserDisconnected);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("chat:new", handleNewMessage);
      socket.off("subtitle", handleSubtitle);
      socket.off("existing-users", handleExistingUsers);
      socket.off("user-connected", handleUserConnected);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("camera:update", handleCameraUpdate);
      socket.off("mic:update", handleMicUpdate);
      socket.off("user-disconnected", handleUserDisconnected);

      audioSenderRef.current?.stop();
      audioSenderRef.current = null;

      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [
    roomId,
    userId,
    userName,
    userAvatar,
    nativeLanguage,
    createPeer,
    removePeer,
    setSubtitle,
    setMessage,
    peersRef,
  ]);

  const disconnectSocket = useCallback(() => {
    audioSenderRef.current?.stop();
    audioSenderRef.current = null;

    socketRef.current?.disconnect();
    socketRef.current = null;

    setSocketId("");
  }, []);

  return {
    socketRef,
    audioSenderRef,
    socketId,
    participants,
    handleSignal,
    disconnectSocket,
    sendMessage,
    updateCamera,
    updateMicrophone,
    updateLanguage,
  };
}
