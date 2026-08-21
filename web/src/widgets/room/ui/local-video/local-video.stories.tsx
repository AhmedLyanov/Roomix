import type { Meta, StoryObj } from "@storybook/nextjs";
import { LocalVideoCard } from "./local-video";

const meta = {
  title: "widgets/room/local-card",
  component: LocalVideoCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof LocalVideoCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const handleFullscreen = () => {
  const element = document.getElementById("local-video");

  if (!element) {
    console.error("Local video element not found");
    return;
  }

  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }

  element.requestFullscreen().catch((error) => {
    console.error("Failed to enter fullscreen:", error);
  });
};

export const CameraOn: Story = {
  args: {
    stream: null,
    userId: "user-1",
    userName: "Ahmed",
    width: 480,
    height: 320,
    cameraEnabled: true,
    onFullscreen: handleFullscreen,
  },
};

export const CameraOff: Story = {
  args: {
    stream: null,
    userId: "user-1",
    userName: "Ahmed",
    width: 480,
    height: 320,
    cameraEnabled: false,
    onFullscreen: handleFullscreen,
  },
};

export const WithAvatar: Story = {
  args: {
    stream: null,
    userId: "user-1",
    userName: "Ahmed",
    width: 480,
    height: 320,
    cameraEnabled: false,
    avatar: "https://i.pravatar.cc/150?img=12",
    onFullscreen: handleFullscreen,
  },
};
