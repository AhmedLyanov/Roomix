import type { Meta, StoryObj } from "@storybook/nextjs";

import { ShareLink } from "./share-link";

const meta = {
  title: "features/share-link",
  component: ShareLink,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ShareLink>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    link: "https://roomix.app/room/abc123",
  },
};

export const LongLink: Story = {
  args: {
    link: "https://roomix.online/room/very-long-room-id-that-should-be-truncated-in-the-component",
  },
};
