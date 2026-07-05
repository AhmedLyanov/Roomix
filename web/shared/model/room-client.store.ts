import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RoomLayoutMode = "focus" | "cinema" | "grid";

interface RoomLayoutStore {
  layoutMode: RoomLayoutMode;

  setLayoutMode: (mode: RoomLayoutMode) => void;
}

export const useRoomLayoutStore = create<RoomLayoutStore>()(
  persist(
    (set) => ({
      layoutMode: "grid",

      setLayoutMode: (layoutMode) =>
        set({
          layoutMode,
        }),
    }),
    {
      name: "room-layout",
    },
  ),
);
