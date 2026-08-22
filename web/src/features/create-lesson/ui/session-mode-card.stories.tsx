import type { Meta, StoryObj } from "@storybook/nextjs";

import { BroadcastIcon, LessonIcon, MeetingIcon } from "@/src/shared/icons/24";

import { SessionModeCard } from "./session-mode-card";

const meta = {
  title: "features/create-lesson",
  component: SessionModeCard,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    icon: {
      table: {
        disable: true,
      },
      control: false,
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SessionModeCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Broadcast: Story = {
  args: {
    icon: <BroadcastIcon />,
    title: "Broadcast",
  },
};

export const Lesson: Story = {
  args: {
    icon: <LessonIcon />,
    title: "Lesson",
  },
};

export const Meeting: Story = {
  args: {
    icon: <MeetingIcon />,
    title: "Meeting",
  },
};
