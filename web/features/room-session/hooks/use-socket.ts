"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";

import { AudioSender } from "@/features/audio-sender";
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
} from "../types";

interface UseSocketProps {
  roomId: string;
  userId: string | undefined;
  userName: string | undefined;
  nativeLanguage: string;
  stream: MediaStream | null;
  peersRef: React.MutableRefObject<Map<string, Peer.Instance>>;
  createPeer: (socketId: string, initiator: boolean) => Peer.Instance | null;
  removePeer: (socketId: string) => void;
  setSubtitle: (data: SubtitlePayload) => void;
}

export function useSocket({
  roomId,
  userId,
  userName,
  nativeLanguage,
  stream,
  peersRef,
  createPeer,
  removePeer,
  setSubtitle,
}: UseSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const audioSenderRef = useRef<AudioSender | null>(null);
  const initializedRef = useRef(false);

  const [socketId, setSocketId] = useState<string>("");
  const [participants, setParticipants] = useState<Map<string, Participant>>(
    new Map(),
  );

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

  useEffect(() => {
    if (!stream || !userId || !userName) return;

    if (initializedRef.current) return;

    initializedRef.current = true;

    const socket = io(process.env.NEXT_PUBLIC_SIGNALING_URL!, {
      path: "/ws",
      transports: ["websocket"],
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketId(socket.id!);

      if (!audioSenderRef.current) {
        audioSenderRef.current = new AudioSender(socket);
        audioSenderRef.current.start(stream);
        audioSenderRef.current.setTranslationEnabled(false);
      }

      const joinPayload: JoinRoomPayload = {
        roomId,
        userId: userId!,
        userName: userName!,
        nativeLanguage,
      };

      socket.emit("join-room", joinPayload);
    });

    socket.on("connect_error", (err: Error) => {
      console.error("[socket]", err.message);
    });

    socket.on("subtitle", (data: SubtitlePayload) => {
      setSubtitle(data);
    });

    socket.on("existing-users", ({ users }: ExistingUsersPayload) => {
      users.forEach(
        ({ socketId, userName }: { socketId: string; userName: string }) => {
          if (socketId === socket.id) return;

          setParticipants((prev) => {
            const next = new Map(prev);
            next.set(socketId, { userName });
            return next;
          });

          createPeer(socketId, true);
        },
      );
    });

    socket.on(
      "user-connected",
      ({ socketId, userName }: UserConnectedPayload) => {
        if (socketId === socket.id) return;

        setParticipants((prev) => {
          const next = new Map(prev);
          next.set(socketId, { userName });
          return next;
        });

        createPeer(socketId, false);
      },
    );

    socket.on("offer", ({ offer, from }: OfferPayload) => {
      let peer = peersRef.current.get(from);

      if (!peer) {
        peer = createPeer(from, false);
      }

      peer?.signal(offer);
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
      audioSenderRef.current?.stop();
      audioSenderRef.current = null;

      socket.disconnect();

      initializedRef.current = false;
    };
  }, [
    roomId,
    userId,
    userName,
    stream,
    nativeLanguage,
    createPeer,
    removePeer,
    setSubtitle,
    peersRef,
  ]);

  const disconnectSocket = useCallback(() => {
    audioSenderRef.current?.stop();
    audioSenderRef.current = null;

    socketRef.current?.disconnect();

    initializedRef.current = false;
  }, []);

  return {
    socketRef,
    audioSenderRef,
    socketId,
    participants,
    handleSignal,
    disconnectSocket,
  };
}
