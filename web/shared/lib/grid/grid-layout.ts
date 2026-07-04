import { useMemo } from "react";

export function useGridLayout(
  participantCount: number,
) {
  return useMemo(() => {
    let columns = 1;
    let rows = 1;
    let videoSize = {
      width: 1192,
      height: 642,
    };

    if (participantCount === 1) {
      columns = 1;
      rows = 1;

      videoSize = {
        width: 1192,
        height: 642,
      };
    }

    if (participantCount === 2) {
      columns = 2;
      rows = 1;

      videoSize = {
        width: 580,
        height: 326,
      };
    }

    if (
      participantCount === 3 ||
      participantCount === 4
    ) {
      columns = 2;
      rows = 2;

      videoSize = {
        width: 580,
        height: 326,
      };
    }

    if (
      participantCount >= 5 &&
      participantCount <= 6
    ) {
      columns = 3;
      rows = 2;

      videoSize = {
        width: 460,
        height: 259,
      };
    }

    if (
      participantCount >= 7 &&
      participantCount <= 9
    ) {
      columns = 3;
      rows = 3;

      videoSize = {
        width: 380,
        height: 214,
      };
    }

    return {
      layout: {
        columns,
        rows,
      },
      videoSize,
    };
  }, [participantCount]);
}