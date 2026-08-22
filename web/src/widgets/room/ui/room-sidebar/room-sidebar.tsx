import { ReactNode, useState } from "react";

import {
  ParticipantsIcon,
  ChatIcon,
  MagicIcon,
  RoomPluginsIcon,
} from "@/src/shared/icons/24";

import RoomChat from "./room-chat/room-chat";
import { useRoomSession } from "@/src/features/room-session";

interface SidebarItem {
  id: string;
  icon: ReactNode;
  label?: string;
  onClick?: () => void;
  badge?: number;
  isActive?: boolean;
}

interface RoomSidebarProps {
  roomId: string;
  participantCount: number;
  roomSession: ReturnType<typeof useRoomSession>;
  onParticipantsClick?: () => void;
  onMagicClick?: () => void;
  onPluginsClick?: () => void;
  customItems?: SidebarItem[];
}

export const RoomSidebar = ({
  roomId,
  participantCount,
  roomSession,
  onParticipantsClick,
  onMagicClick,
  onPluginsClick,
  customItems = [],
}: RoomSidebarProps) => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleChatClick = () => {
    setIsChatOpen(!isChatOpen);
  };

  const defaultItems: SidebarItem[] = [
    {
      id: "participants",
      icon: <ParticipantsIcon />,
      label: `${participantCount} participants`,
      onClick: onParticipantsClick,
      badge: participantCount,
    },
    {
      id: "chat",
      icon: <ChatIcon />,
      label: "Chat",
      onClick: handleChatClick,
      isActive: isChatOpen,
    },
    {
      id: "magic",
      icon: <MagicIcon />,
      label: "AI Magic",
      onClick: onMagicClick,
    },
    {
      id: "plugins",
      icon: <RoomPluginsIcon />,
      label: "Plugins",
      onClick: onPluginsClick,
    },
  ];

  const items = [...defaultItems, ...customItems];

  return (
    <>
      <div
        className="
          absolute
          top-22.5
          right-0
          z-20
          flex
          flex-col
          items-center
          justify-between
          gap-7
          rounded-l-[20px]
          bg-(--room-navigation-bg)
          px-3.5
          py-5.75
        "
      >
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`
              relative
              flex
              items-center
              gap-px
              text-(--color-gray-light)
              transition-colors
              hover:text-white
              ${item.isActive ? "text-white" : ""}
            `}
            aria-label={item.label}
            title={item.label}
          >
            {item.icon}
            {item.badge !== undefined && item.badge > 0 && (
              <span className="text-[14px] leading-none">{item.badge}</span>
            )}
          </button>
        ))}
      </div>

      <RoomChat
        roomId={roomId}
        isOpen={isChatOpen}
        roomSession={roomSession}
        onClose={() => setIsChatOpen(false)}
      />
    </>
  );
};
