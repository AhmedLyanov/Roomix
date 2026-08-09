"use client";

import { useRoomLayoutStore } from "@/src/shared/model/room-client.store";

import {
  MeetVariantOneIcon,
  MeetVariantTwoIcon,
  MeetVariantThreeIcon,
} from "@/src/shared/icons/24";

export function RoomLayoutSwitcher() {
  const { layoutMode, setLayoutMode } = useRoomLayoutStore();

  return (
    <div className="absolute top-3.75 right-3.5 flex items-center gap-2">
      <button
        onClick={() => setLayoutMode("cinema")}
        className={`
          transition-all duration-200
          ${
            layoutMode === "cinema" ? "text-white" : "text-(--room-layout-type)"
          }
        `}
      >
        <MeetVariantOneIcon />
      </button>

      <button
        onClick={() => setLayoutMode("focus")}
        className={`
          transition-all duration-200
          ${layoutMode === "focus" ? "text-white" : "text-(--room-layout-type)"}
        `}
      >
        <MeetVariantTwoIcon />
      </button>

      <button
        onClick={() => setLayoutMode("grid")}
        className={`
          transition-all duration-200
          ${layoutMode === "grid" ? "text-white" : "text-(--room-layout-type)"}
        `}
      >
        <MeetVariantThreeIcon />
      </button>
    </div>
  );
}
