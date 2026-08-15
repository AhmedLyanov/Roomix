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
import { RoomMessage } from "../model/use-room-session";

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

  /**
   * Prevents the socket from being recreated because of
   * React StrictMode / development remounts.
   */
  const initializedRef = useRef(false);

  /**
   * Stores the latest stream without making the socket
   * effect depend on stream.
   */
  const streamRef = useRef<MediaStream | null>(stream);

  /**
   * Delayed disconnect allows React StrictMode to perform
   * its development remount without actually destroying
   * the session.
   */
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [socketId, setSocketId] = useState("");
  const [participants, setParticipants] = useState<Map<string, Participant>>(
    new Map(),
  );

  useEffect(() => {
    streamRef.current = stream;

    if (audioSenderRef.current && stream) {
      audioSenderRef.current.stop();
      audioSenderRef.current = null;

      const socket = socketRef.current;

      if (socket) {
        audioSenderRef.current = new AudioSender(socket);
        audioSenderRef.current.start(stream);
        audioSenderRef.current.setTranslationEnabled(false);
      }
    }
  }, [stream]);

  const handleSignal = useCallback((signal: SignalData) => {
    if (!socketRef.current) return;

    switch (signal.type) {
      case "offer":
        socketRef.current.emit("offer", {
          offer: signal.data,
          to: signal.to,
        });
        break;

      case "answer":
        socketRef.current.emit("answer", {
          answer: signal.data,
          to: signal.to,
        });
        break;

      case "ice-candidate":
        socketRef.current.emit("ice-candidate", {
          candidate: signal.data,
          to: signal.to,
        });
        break;
    }
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      if (!socketRef.current) return;
      if (!text.trim()) return;

      socketRef.current.emit("chat:send", {
        roomId,
        senderId: userId,
        senderName: userName,
        senderAvatar: userAvatar,
        text: text.trim(),
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
    if (!userId || !userName) return;

    /**
     * If React remounts the component immediately,
     * cancel the pending disconnect instead of creating
     * another socket/session.
     */
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const socket = io(process.env.NEXT_PUBLIC_SIGNALING_URL!, {
      path: "/ws",
      transports: ["websocket"],
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketId(socket.id!);

      const currentStream = streamRef.current;

      if (currentStream && !audioSenderRef.current) {
        audioSenderRef.current = new AudioSender(socket);

        audioSenderRef.current.start(currentStream);

        audioSenderRef.current.setTranslationEnabled(false);
      }

      const joinPayload: JoinRoomPayload = {
        roomId,
        userId,
        userName,
        nativeLanguage,
        userAvatar,
      };

      socket.emit("join-room", joinPayload);
    });

    socket.on("connect_error", (err: Error) => {
      console.error("[socket]", err.message);
    });

    socket.on("subtitle", (data: SubtitlePayload) => {
      setSubtitle(data);
    });

    socket.on("chat:new", (message: RoomMessage) => {
      setMessage(message);
    });

    socket.on("existing-users", ({ users }: ExistingUsersPayload) => {
      users.forEach(
        ({
          socketId,
          userName,
          userAvatar,
          cameraEnabled,
          microphoneEnabled,
        }) => {
          if (socketId === socket.id) {
            return;
          }

          setParticipants((prev) => {
            const next = new Map(prev);

            next.set(socketId, {
              userId,
              userName,
              userAvatar,
              cameraEnabled,
              microphoneEnabled,
            });

            return next;
          });

          createPeer(socketId, true);
        },
      );
    });

    socket.on(
      "user-connected",
      ({
        socketId,
        userName,
        userAvatar,
        cameraEnabled,
        microphoneEnabled,
      }: UserConnectedPayload) => {
        if (socketId === socket.id) {
          return;
        }

        setParticipants((prev) => {
          const next = new Map(prev);

          next.set(socketId, {
            userId,
            userName,
            userAvatar,
            cameraEnabled,
            microphoneEnabled,
          });

          return next;
        });

        createPeer(socketId, false);
      },
    );

    socket.on("camera:update", ({ socketId, enabled }) => {
      setParticipants((prev) => {
        const next = new Map(prev);

        const participant = next.get(socketId);

        if (!participant) {
          return prev;
        }

        next.set(socketId, {
          ...participant,
          cameraEnabled: enabled,
        });

        return next;
      });
    });

    socket.on(
      "mic:update",
      ({ socketId, enabled }: MicrophoneUpdatePayload) => {
        setParticipants((prev) => {
          const next = new Map(prev);

          const participant = next.get(socketId);

          if (!participant) {
            return prev;
          }

          next.set(socketId, {
            ...participant,
            microphoneEnabled: enabled,
          });

          return next;
        });
      },
    );

    socket.on("offer", ({ offer, from }: OfferPayload) => {
      let peer = peersRef.current.get(from);

      if (!peer) {
        const createdPeer = createPeer(from, false);

        if (!createdPeer) {
          return;
        }

        peer = createdPeer;
      }

      peer.signal(offer);
    });

    socket.on("answer", ({ answer, from }: AnswerPayload) => {
      peersRef.current.get(from)?.signal(answer);
    });

    socket.on("ice-candidate", ({ candidate, from }: IceCandidatePayload) => {
      peersRef.current.get(from)?.signal(candidate);
    });

    socket.on("user-disconnected", ({ socketId }: UserDisconnectedPayload) => {
      removePeer(socketId);

      setParticipants((prev) => {
        const next = new Map(prev);

        next.delete(socketId);

        return next;
      });
    });

    return () => {
      /**
       * Don't immediately disconnect.
       *
       * React StrictMode does:
       *
       * mount
       * cleanup
       * mount
       *
       * in development.
       *
       * If we disconnect immediately, backend sees:
       *
       * disconnect -> finishSession()
       * second mount -> createSession()
       *
       * which creates two sessions.
       */
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
      }

      disconnectTimerRef.current = setTimeout(() => {
        audioSenderRef.current?.stop();
        audioSenderRef.current = null;

        socket.disconnect();

        socketRef.current = null;

        initializedRef.current = false;

        disconnectTimerRef.current = null;
      }, 100);
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
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);

      disconnectTimerRef.current = null;
    }

    audioSenderRef.current?.stop();
    audioSenderRef.current = null;

    socketRef.current?.disconnect();
    socketRef.current = null;

    initializedRef.current = false;
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
