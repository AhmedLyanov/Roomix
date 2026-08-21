import type { Meta, StoryObj } from "@storybook/nextjs";
import { Spinner } from "./spinner";

const meta = {
  title: "Shared/Spinner",
  component: Spinner,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
