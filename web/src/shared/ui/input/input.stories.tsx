import type { Meta, StoryObj } from "@storybook/nextjs";
import { Input } from "./input";

const meta = {
  title: "Shared/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
