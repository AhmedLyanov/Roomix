import { useMemo } from "react";

export function useGridLayout(containerRef: any, participantCount: number) {
  return useMemo(() => {
    const cols = Math.ceil(Math.sqrt(participantCount));
    const rows = Math.ceil(participantCount / cols);
    const videoSize = { width: 320, height: 240 };
    return { layout: { columns: cols, rows }, videoSize };
  }, [participantCount]);
}
