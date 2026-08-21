import type { Meta, StoryObj } from "@storybook/nextjs";
import { RemoteVideoCard } from "./remote-video";

const meta = {
  title: "widgets/room/remote-card",
  component: RemoteVideoCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RemoteVideoCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const handleFullscreen = () => {
  const element = document.getElementById("video-user-1");

  if (!element) {
    return;
  }

  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }

  element.requestFullscreen();
};

export const CameraOn: Story = {
  args: {
    stream: null as unknown as MediaStream,
    userId: "user-1",
    userName: "Ahmed",
    width: 480,
    height: 320,
    cameraEnabled: true,
    microphoneEnabled: true,
    onFullscreen: handleFullscreen,
  },
};

export const CameraOff: Story = {
  args: {
    stream: null as unknown as MediaStream,
    userId: "user-1",
    userName: "Ahmed",
    width: 480,
    height: 320,
    cameraEnabled: false,
    microphoneEnabled: true,
    onFullscreen: handleFullscreen,
  },
};

export const CameraAndMicrophoneOff: Story = {
  args: {
    stream: null as unknown as MediaStream,
    userId: "user-1",
    userName: "Ahmed",
    width: 480,
    height: 320,
    cameraEnabled: false,
    microphoneEnabled: false,
    onFullscreen: handleFullscreen,
  },
};

export const WithAvatar: Story = {
  args: {
    stream: null as unknown as MediaStream,
    userId: "user-1",
    userName: "John",
    width: 480,
    height: 320,
    cameraEnabled: false,
    microphoneEnabled: false,
    avatar: "https://i.pravatar.cc/150?img=5",
    onFullscreen: handleFullscreen,
  },
};
