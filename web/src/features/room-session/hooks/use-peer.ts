"use client";

import { useRef, useState, useCallback } from "react";
import Peer from "simple-peer";

import type { SignalData } from "../model/types";

export function usePeer(stream: MediaStream | null) {
  const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

  const onSignalRef = useRef<(signal: SignalData) => void>(() => {});

  const [remoteVideos, setRemoteVideos] = useState<Map<string, MediaStream>>(
    new Map(),
  );

  const setOnSignal = useCallback((handler: (signal: SignalData) => void) => {
    onSignalRef.current = handler;
  }, []);

  const removePeer = useCallback((socketId: string) => {
    const peer = peersRef.current.get(socketId);

    if (peer) {
      peer.removeAllListeners();
      peer.destroy();
    }

    peersRef.current.delete(socketId);
    remoteStreamsRef.current.delete(socketId);

    setRemoteVideos(new Map(remoteStreamsRef.current));
  }, []);

  const createPeer = useCallback(
    (socketId: string, initiator: boolean) => {
      if (!stream) {
        console.warn("[WebRTC] Cannot create peer: stream is null");
        return null;
      }

      const existingPeer = peersRef.current.get(socketId);

      if (existingPeer) {
        return existingPeer;
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

      peer.on("signal", (data: Peer.SignalData) => {
        const signalData = data as { type?: string };

        if (signalData.type === "offer") {
          onSignalRef.current({
            type: "offer",
            data,
            to: socketId,
          });

          return;
        }

        if (signalData.type === "answer") {
          onSignalRef.current({
            type: "answer",
            data,
            to: socketId,
          });

          return;
        }

        onSignalRef.current({
          type: "ice-candidate",
          data,
          to: socketId,
        });
      });

      peer.on("stream", (remoteStream: MediaStream) => {
        remoteStreamsRef.current.set(socketId, remoteStream);

        setRemoteVideos(new Map(remoteStreamsRef.current));
      });

      peer.on("connect", () => {});

      peer.on("close", () => {
        removePeer(socketId);
      });

      peer.on("error", (error) => {
        console.error(`[WebRTC] Peer error ${socketId}:`, error);

        removePeer(socketId);
      });

      peersRef.current.set(socketId, peer);

      return peer;
    },
    [stream, removePeer],
  );

  const destroyAllPeers = useCallback(() => {
    peersRef.current.forEach((peer) => {
      peer.removeAllListeners();
      peer.destroy();
    });

    peersRef.current.clear();
    remoteStreamsRef.current.clear();

    setRemoteVideos(new Map());
  }, []);

  return {
    peersRef,
    remoteVideos,
    createPeer,
    removePeer,
    destroyAllPeers,
    setOnSignal,
  };
}
