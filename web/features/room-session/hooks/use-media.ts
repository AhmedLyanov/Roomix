// features/room-session/hooks/use-media.ts
"use client";

import { useEffect, useState, useCallback } from "react";

export function useMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);

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
        localStream = mediaStream;
        setStream(mediaStream);
      })
      .catch((err) => {
        console.error("[useMedia] getUserMedia error:", err);
      });

    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopStream = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  }, [stream]);

  return {
    stream,
    stopStream,
  };
}
