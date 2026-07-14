"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";

import { AudioSender } from "@/features/audio-sender";

export interface SubtitleData {
  originalText: string;
  translatedText: string;
  speakerId: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
}

interface UseRoomSessionProps {
  roomId: string;
  userId?: string;
  userName?: string;
  nativeLanguage: string;
}

export function useRoomSession({
  roomId,
  userId,
  userName,
  nativeLanguage,
}: UseRoomSessionProps) {
  const socketRef = useRef<Socket | null>(null);
  const audioSenderRef = useRef<AudioSender | null>(null);
  const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const initializedRef = useRef(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteVideos, setRemoteVideos] = useState<Map<string, MediaStream>>(
    new Map(),
  );
  const [participants, setParticipants] = useState<
    Map<string, { userName: string }>
  >(new Map());
  const [subtitles, setSubtitles] = useState<Map<string, SubtitleData>>(
    new Map(),
  );
  const [socketId, setSocketId] = useState<string>("");

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalTrackRef = useRef<MediaStreamTrack | null>(null);

  // Таймер для очистки старых субтитров (каждые 5 секунд)
  useEffect(() => {
    const interval = setInterval(() => {
      setSubtitles((prev) => {
        const now = Date.now();
        const next = new Map();
        for (const [key, value] of prev) {
          if (now - value.timestamp < 5000) {
            next.set(key, value);
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const removePeer = useCallback((socketId: string) => {
    console.log("[useRoomSession] removePeer:", socketId);
    peersRef.current.get(socketId)?.destroy();
    peersRef.current.delete(socketId);
    remoteStreamsRef.current.delete(socketId);
    setRemoteVideos(new Map(remoteStreamsRef.current));

    setParticipants((prev) => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
  }, []);

  const createPeer = useCallback(
    (socketId: string, initiator: boolean) => {
      if (!stream) return null;

      if (peersRef.current.has(socketId)) {
        return peersRef.current.get(socketId)!;
      }

      const peer = new Peer({
        initiator,
        trickle: true,
        stream,
        config: {
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        },
      });

      peer.on("signal", (data) => {
        if (!socketRef.current) return;

        const signalData = data as { type?: string };

        if (signalData.type === "offer") {
          socketRef.current.emit("offer", { offer: data, to: socketId });
        } else if (signalData.type === "answer") {
          socketRef.current.emit("answer", { answer: data, to: socketId });
        } else {
          socketRef.current.emit("ice-candidate", {
            candidate: data,
            to: socketId,
          });
        }
      });

      peer.on("stream", (remoteStream) => {
        remoteStreamsRef.current.set(socketId, remoteStream);
        setRemoteVideos(new Map(remoteStreamsRef.current));
      });

      peer.on("close", () => removePeer(socketId));
      peer.on("error", () => removePeer(socketId));

      peersRef.current.set(socketId, peer);
      return peer;
    },
    [stream, removePeer],
  );

  // Получение медиапотока
  useEffect(() => {
    let localStream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      })
      .then((mediaStream) => {
        console.log("[useRoomSession] ✅ Media stream obtained");
        localStream = mediaStream;
        setStream(mediaStream);
      })
      .catch((err) => {
        console.error("[useRoomSession] ❌ getUserMedia error:", err);
      });

    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Основная инициализация
  useEffect(() => {
    if (!stream || !userId || !userName) {
      console.log("[useRoomSession] ⏳ Waiting for stream/userId/userName...");
      return;
    }

    if (initializedRef.current) {
      console.log("[useRoomSession] ⏭️ Already initialized, skipping");
      return;
    }

    initializedRef.current = true;
    console.log("[useRoomSession] 🔌 Initializing socket connection...");

    const socket = io(
      process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:5000",
      {
        path: "/ws",
        transports: ["websocket"],
        forceNew: true,
      },
    );

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[useRoomSession] ✅ SOCKET CONNECTED, id:", socket.id);
      setSocketId(socket.id);

      // Создаем и запускаем AudioSender
      if (!audioSenderRef.current) {
        console.log(
          "[useRoomSession] 🎤 Creating AudioSender from existing MediaStream",
        );
        audioSenderRef.current = new AudioSender(socket);
        audioSenderRef.current.start(stream);
        console.log("[useRoomSession] ▶️ AudioSender started");
      }

      socket.emit("join-room", {
        roomId,
        userId,
        userName,
        nativeLanguage,
      });
      console.log("[useRoomSession] 📤 'join-room' emitted");
    });

    socket.on("connect_error", (err) => {
      console.error("[useRoomSession] ❌ SOCKET CONNECT ERROR:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("[useRoomSession] 🔌 SOCKET DISCONNECTED:", reason);
    });

    socket.on("subtitle", (data) => {
      console.log("[useRoomSession] 📥 RECEIVED 'subtitle':", data);
      setSubtitles((prev) => {
        const next = new Map(prev);
        next.set(data.speakerId, {
          ...data,
          timestamp: Date.now(),
        });
        return next;
      });
    });

    socket.on("existing-users", ({ users }) => {
      console.log("[useRoomSession] 👥 existing-users:", users.length);
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

    socket.on("user-connected", ({ socketId, userName }) => {
      if (socketId === socket.id) return;

      setParticipants((prev) => {
        const next = new Map(prev);
        next.set(socketId, { userName });
        return next;
      });

      createPeer(socketId, false);
    });

    socket.on("offer", ({ offer, from }) => {
      let peer = peersRef.current.get(from);
      if (!peer) {
        peer = createPeer(from, false);
      }
      peer?.signal(offer);
    });

    socket.on("answer", ({ answer, from }) => {
      peersRef.current.get(from)?.signal(answer);
    });

    socket.on("ice-candidate", ({ candidate, from }) => {
      peersRef.current.get(from)?.signal(candidate);
    });

    socket.on("user-disconnected", ({ socketId }) => {
      removePeer(socketId);
      setSubtitles((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    });

    return () => {
      console.log("[useRoomSession] 🧹 CLEANUP");

      // Останавливаем AudioSender
      audioSenderRef.current?.stop();
      audioSenderRef.current = null;

      // Отключаем сокет
      socket.disconnect();

      // Очищаем WebRTC пиры
      peersRef.current.forEach((peer) => peer.destroy());
      peersRef.current.clear();
      remoteStreamsRef.current.clear();

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
  ]);

  const toggleCamera = () => {
    if (!stream) return;
    const enabled = !isCameraOn;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setIsCameraOn(enabled);
  };

  const toggleMic = () => {
    if (!stream) return;
    const enabled = !isMicOn;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    // Синхронизируем состояние с AudioSender
    audioSenderRef.current?.setMicEnabled(enabled);
    setIsMicOn(enabled);
  };

  const toggleScreenShare = useCallback(() => {
    console.log("[useRoomSession] toggleScreenShare — not implemented yet");
  }, []);

  const disconnect = useCallback(() => {
    console.log("[useRoomSession] disconnect() called");

    audioSenderRef.current?.stop();
    audioSenderRef.current = null;

    socketRef.current?.disconnect();
    peersRef.current.forEach((peer) => peer.destroy());
    peersRef.current.clear();
    stream?.getTracks().forEach((track) => track.stop());
    setRemoteVideos(new Map());
    setParticipants(new Map());
    setSubtitles(new Map());
    setStream(null);
    initializedRef.current = false;
  }, [stream]);

  return {
    stream,
    remoteVideos,
    participants,
    subtitles,
    socketId,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
    disconnect,
  };
}
