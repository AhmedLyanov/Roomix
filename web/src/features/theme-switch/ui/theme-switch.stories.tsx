import type { Meta, StoryObj } from "@storybook/nextjs";

import { ThemeSwitch } from "./theme-switch";

const meta = {
  title: "features/theme-switch",
  component: ThemeSwitch,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ThemeSwitch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = {
  parameters: {
    backgrounds: {
      default: "dark",
    },
  },
};

export const Light: Story = {
  parameters: {
    backgrounds: {
      default: "light",
    },
  },
};
