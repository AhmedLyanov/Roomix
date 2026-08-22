import type { Meta, StoryObj } from "@storybook/nextjs";
import { RoomControl } from "./room-control";

const meta = {
  title: "widgets/room/room-control",
  component: RoomControl,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RoomControl>;

export default meta;

type Story = StoryObj<typeof meta>;

const defaultArgs = {
  isCameraOn: true,
  isMicOn: true,
  isTranslationEnabled: false,
  isScreenSharing: false,
  nativeLanguage: "ru",
  onLanguageChange: () => {},
  onToggleCamera: () => {},
  onToggleMic: () => {},
  onToggleTranslation: () => {},
  onToggleScreenShare: () => {},
  onLeaveRoom: () => {},
};

export const Default: Story = {
  args: {
    ...defaultArgs,
  },
};

export const CameraOff: Story = {
  args: {
    ...defaultArgs,
    isCameraOn: false,
  },
};

export const MicrophoneOff: Story = {
  args: {
    ...defaultArgs,
    isMicOn: false,
  },
};

export const TranslationEnabled: Story = {
  args: {
    ...defaultArgs,
    isTranslationEnabled: true,
  },
};

export const ScreenSharing: Story = {
  args: {
    ...defaultArgs,
    isScreenSharing: true,
  },
};

export const AllControlsActive: Story = {
  args: {
    ...defaultArgs,
    isCameraOn: true,
    isMicOn: true,
    isTranslationEnabled: true,
    isScreenSharing: true,
    nativeLanguage: "en",
  },
};
