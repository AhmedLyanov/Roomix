"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";

import { SpeechService } from "@/features/speech-recognition";

interface UseRoomSessionProps {
  roomId: string;
  userId?: string;
  userName?: string;
}

export function useRoomSession({
  roomId,
  userId,
  userName,
}: UseRoomSessionProps) {
  const socketRef = useRef<Socket | null>(null);
  const speechRef = useRef<SpeechService | null>(null);

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

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalTrackRef = useRef<MediaStreamTrack | null>(null);

  const removePeer = useCallback((socketId: string) => {
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
          iceServers: [
            {
              urls: "stun:stun.l.google.com:19302",
            },
          ],
        },
      });

      peer.on("signal", (data) => {
        if (!socketRef.current) return;

        const signalData = data as { type?: string };

        if (signalData.type === "offer") {
          socketRef.current.emit("offer", {
            offer: data,
            to: socketId,
          });
        } else if (signalData.type === "answer") {
          socketRef.current.emit("answer", {
            answer: data,
            to: socketId,
          });
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

  useEffect(() => {
    let localStream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((mediaStream) => {
        localStream = mediaStream;
        setStream(mediaStream);
      })
      .catch(console.error);

    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!stream || !userId || !userName) {
      return;
    }

    if (initializedRef.current) return;

    initializedRef.current = true;

    const socket = io(
      process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:5000",
      {
        path: "/ws",
        transports: ["websocket"],
      },
    );

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("SOCKET CONNECTED");

      speechRef.current = new SpeechService("ru");

      speechRef.current.onResult((text) => {
        console.log("TEXT:", text);

        socket.emit("speech", {
          text,
        });
      });

      speechRef.current.start();

      socket.emit("join-room", {
        roomId,
        userId,
        userName,
        language: "ru",
      });
    });

    socket.on("existing-users", ({ users }) => {
      users.forEach(({ socketId, userName }) => {
        if (socketId === socket.id) return;

        setParticipants((prev) => {
          const next = new Map(prev);
          next.set(socketId, { userName });
          return next;
        });

        createPeer(socketId, true);
      });
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
    });

    return () => {
      speechRef.current?.stop();
      speechRef.current = null;

      socket.disconnect();

      peersRef.current.forEach((peer) => peer.destroy());

      peersRef.current.clear();
      remoteStreamsRef.current.clear();

      initializedRef.current = false;
    };
  }, [roomId, userId, userName, stream, createPeer, removePeer]);

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

    setIsMicOn(enabled);
  };

  const disconnect = useCallback(() => {
    speechRef.current?.stop();
    speechRef.current = null;

    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;

    peersRef.current.forEach((peer) => {
      try {
        const pc = (
          peer as Peer.Instance & {
            _pc?: RTCPeerConnection;
          }
        )._pc;

        pc?.getSenders()?.forEach((sender) => {
          sender.track?.stop();
        });

        pc?.close();
        peer.destroy();
      } catch (err) {
        console.error(err);
      }
    });

    peersRef.current.clear();

    stream?.getTracks().forEach((track) => track.stop());

    screenStreamRef.current?.getTracks().forEach((track) => track.stop());

    remoteStreamsRef.current.forEach((remoteStream) => {
      remoteStream.getTracks().forEach((track) => track.stop());
    });

    remoteStreamsRef.current.clear();

    screenStreamRef.current = null;
    originalTrackRef.current = null;

    setRemoteVideos(new Map());
    setParticipants(new Map());

    setStream(null);

    initializedRef.current = false;
  }, [stream]);

  return {
    stream,
    remoteVideos,
    participants,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    toggleCamera,
    toggleMic,
    disconnect,
  };
}
