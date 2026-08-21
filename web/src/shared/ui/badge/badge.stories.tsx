import type { Meta, StoryObj } from "@storybook/nextjs";
import { Badge } from "./badge";

const meta = {
  title: "Shared/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    badge: {
      control: "text",
      description: "Текст бейджа",
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    badge: "PRO",
  },
};

export const New: Story = {
  args: {
    badge: "NEW",
  },
};

export const LongText: Story = {
  args: {
    badge: "Новая конференция",
  },
};
