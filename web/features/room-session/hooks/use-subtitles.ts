"use client";

import { useState, useEffect, useCallback } from "react";
import type { SubtitleData } from "../model/types";

export function useSubtitles() {
  const [subtitles, setSubtitles] = useState<Map<string, SubtitleData>>(
    new Map(),
  );
  useEffect(() => {
    const interval = setInterval(() => {
      setSubtitles((prev) => {
        if (prev.size === 0) {
          return prev;
        }

        const now = Date.now();
        const next = new Map();

        for (const [key, value] of prev) {
          if (now - value.timestamp < 5000) {
            next.set(key, value);
          }
        }

        if (next.size === prev.size) {
          return prev;
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const setSubtitle = useCallback((data: Omit<SubtitleData, "timestamp">) => {
    setSubtitles((prev) => {
      const next = new Map(prev);

      next.set(data.speakerId, {
        ...data,
        timestamp: Date.now(),
      });

      return next;
    });
  }, []);

  const clearSubtitles = useCallback(() => {
    setSubtitles(new Map());
  }, []);

  return {
    subtitles,
    setSubtitle,
    clearSubtitles,
  };
}
