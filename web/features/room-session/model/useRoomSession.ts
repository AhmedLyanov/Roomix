"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";

interface UseRoomSessionProps {
  roomId: string;
  userName: string;
}

export function useRoomSession({ roomId, userName }: UseRoomSessionProps) {
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

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
      const map = new Map(prev);
      map.delete(socketId);
      return map;
    });
  }, []);

  const createPeer = useCallback(
    (socketId: string, initiator: boolean): Peer.Instance => {
      const peer = new Peer({
        initiator,
        trickle: true,
        stream: stream!,
        config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
      });

      peer.on("signal", (data: any) => {
        if (!socketRef.current) return;
        if (data.type === "offer") {
          socketRef.current.emit("offer", { offer: data, to: socketId });
        } else if (data.type === "answer") {
          socketRef.current.emit("answer", { answer: data, to: socketId });
        } else {
          socketRef.current.emit("ice-candidate", {
            candidate: data,
            to: socketId,
          });
        }
      });

      peer.on("stream", (remoteStream: MediaStream) => {
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

  // Initialize media stream
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        setStream(mediaStream);
        setIsCameraOn(true);
        setIsMicOn(true);
      })
      .catch(() => {
        alert("Failed to access camera/microphone");
      });

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Connect to signaling server
  useEffect(() => {
    if (!stream || !userName) return;

    const signalingUrl =
      process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:5000";
    const socket = io(signalingUrl, { path: "/ws", transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-room", { roomId, userId: socket.id, userName });
    });

    socket.on("existing-users", ({ users }: any) => {
      users.forEach(({ socketId, userName: uName }: any) => {
        setParticipants((prev) =>
          new Map(prev).set(socketId, { userName: uName }),
        );
        if (!peersRef.current.has(socketId)) createPeer(socketId, false);
      });
    });

    socket.on("user-connected", ({ socketId, userName: uName }: any) => {
      setParticipants((prev) =>
        new Map(prev).set(socketId, { userName: uName }),
      );
      if (!peersRef.current.has(socketId)) createPeer(socketId, true);
    });

    socket.on("offer", ({ offer, from }: any) => {
      let peer = peersRef.current.get(from);
      if (!peer) peer = createPeer(from, false);
      peer.signal(offer);
    });

    socket.on("answer", ({ answer, from }: any) => {
      const peer = peersRef.current.get(from);
      if (peer) peer.signal(answer);
    });

    socket.on("ice-candidate", ({ candidate, from }: any) => {
      const peer = peersRef.current.get(from);
      if (peer) peer.signal(candidate);
    });

    socket.on("user-disconnected", ({ socketId }: any) => removePeer(socketId));

    return () => {
      const currentPeers = new Map(peersRef.current);
      socket.disconnect();
      currentPeers.forEach((p) => p.destroy());
      peersRef.current.clear();
    };
  }, [stream, userName, roomId, createPeer]);

  const toggleCamera = () => {
    if (!stream) return;
    const enabled = !isCameraOn;
    stream.getVideoTracks().forEach((t) => (t.enabled = enabled));
    setIsCameraOn(enabled);
  };

  const toggleMic = () => {
    if (!stream) return;
    const enabled = !isMicOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = enabled));
    setIsMicOn(enabled);
  };

  const toggleScreenShare = async () => {
    if (!stream) return;

    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        const cameraTrack = stream.getVideoTracks()[0];
        originalTrackRef.current = cameraTrack;
        screenStreamRef.current = screenStream;

        peersRef.current.forEach((peer) => {
          const sender = (peer as any)._pc
            ?.getSenders()
            .find((s: any) => s.track === cameraTrack);
          sender?.replaceTrack(screenTrack);
        });

        stream.removeTrack(cameraTrack);
        stream.addTrack(screenTrack);

        screenTrack.onended = stopScreenShare;
        setIsScreenSharing(true);
      } catch (err) {
        console.error("Failed to start screen sharing:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (!stream || !originalTrackRef.current) return;
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
    const cameraTrack = originalTrackRef.current;

    peersRef.current.forEach((peer) => {
      const sender = (peer as any)._pc
        ?.getSenders()
        .find((s: any) => s.track === screenTrack);
      sender?.replaceTrack(cameraTrack);
    });

    if (screenTrack) stream.removeTrack(screenTrack);
    stream.addTrack(cameraTrack);

    screenStreamRef.current?.getTracks().forEach((t) => t.stop());

    setIsScreenSharing(false);
    screenStreamRef.current = null;
    originalTrackRef.current = null;
  };

  return {
    stream,
    remoteVideos,
    participants,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
    disconnect: () => {
      peersRef.current.forEach((p) => p.destroy());
      peersRef.current.clear();
      socketRef.current?.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
    },
  };
}
