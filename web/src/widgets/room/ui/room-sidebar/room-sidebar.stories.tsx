import type { Meta, StoryObj } from "@storybook/nextjs";

import { ParticipantsIcon, MagicIcon } from "@/src/shared/icons/24";
import { useRoomSession } from "@/src/features/room-session";

import { RoomSidebar } from "./room-sidebar";

const mockRoomSession = {
  messages: [],
  sendMessage: () => {},
} as unknown as ReturnType<typeof useRoomSession>;

const meta = {
  title: "widgets/room/room-sidebar",
  component: RoomSidebar,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="relative h-[600px] w-full">
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof RoomSidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    roomId: "room-1",
    participantCount: 3,
    roomSession: mockRoomSession,
  },
};

export const OneParticipant: Story = {
  args: {
    roomId: "room-1",
    participantCount: 1,
    roomSession: mockRoomSession,
  },
};

export const ManyParticipants: Story = {
  args: {
    roomId: "room-1",
    participantCount: 24,
    roomSession: mockRoomSession,
  },
};

export const WithCustomItems: Story = {
  args: {
    roomId: "room-1",
    participantCount: 5,
    roomSession: mockRoomSession,
    customItems: [
      {
        id: "custom-participants",
        icon: <ParticipantsIcon />,
        label: "Custom participants",
        badge: 5,
      },
      {
        id: "custom-ai",
        icon: <MagicIcon />,
        label: "Custom AI",
        isActive: true,
      },
    ],
  },
};
