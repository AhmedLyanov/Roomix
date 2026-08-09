"use client";

import { useState } from "react";

export function useFullscreen(
  { autoEnterOnScreenShare = false } = { autoEnterOnScreenShare: false },
) {
  const [fullscreenTarget, setFullscreenTarget] = useState<string | null>(null);

  const toggleFullscreen = async (el: HTMLElement | null, id?: string) => {
    if (!el) return;
    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen();
        setFullscreenTarget(id || "local");
      } catch {}
    } else {
      try {
        await document.exitFullscreen();
        setFullscreenTarget(null);
      } catch {}
    }
  };

  const exitFullscreen = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
        setFullscreenTarget(null);
      } catch {}
    }
  };

  return { fullscreenTarget, toggleFullscreen, exitFullscreen };
}
