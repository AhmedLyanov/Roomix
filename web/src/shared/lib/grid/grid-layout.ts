import { useMemo } from "react";

export type RoomLayoutMode = "focus" | "cinema" | "grid";

interface LayoutConfig {
  mode: RoomLayoutMode;

  grid: {
    columns: number;
    rows: number;
  };

  mainVideo: {
    width: number;
    height: number;
  };

  sidebarVideo?: {
    width: number;
    height: number;
  };
}

export function useGridLayout(
  participantCount: number,
  mode: RoomLayoutMode,
): LayoutConfig {
  return useMemo(() => {
    if (mode === "cinema") {
      return {
        mode,

        grid: {
          columns: 1,
          rows: 1,
        },

        mainVideo: {
          width: 1192,
          height: 642,
        },
      };
    }

    if (mode === "focus") {
      return {
        mode,

        grid: {
          columns: 2,
          rows: 1,
        },

        mainVideo: {
          width: 935,
          height: 642,
        },

        sidebarVideo: {
          width: 220,
          height: 124,
        },
      };
    }

    let columns = 1;
    let rows = 1;

    let width = 1192;
    let height = 642;

    if (participantCount === 1) {
      columns = 1;
      rows = 1;

      width = 1192;
      height = 642;
    }

    if (participantCount === 2) {
      columns = 2;
      rows = 1;

      width = 580;
      height = 326;
    }

    if (participantCount === 3) {
      columns = 2;
      rows = 2;

      width = 580;
      height = 326;
    }

    if (participantCount === 4) {
      columns = 2;
      rows = 2;

      width = 460;
      height = 327;
    }

    if (participantCount >= 5 && participantCount <= 6) {
      columns = 3;
      rows = 2;

      width = 460;
      height = 259;
    }

    if (participantCount >= 7 && participantCount <= 9) {
      columns = 3;
      rows = 3;

      width = 380;
      height = 214;
    }

    if (participantCount > 9) {
      columns = 4;
      rows = Math.ceil(participantCount / columns);

      width = 320;
      height = 180;
    }

    return {
      mode,

      grid: {
        columns,
        rows,
      },

      mainVideo: {
        width,
        height,
      },
    };
  }, [participantCount, mode]);
}
