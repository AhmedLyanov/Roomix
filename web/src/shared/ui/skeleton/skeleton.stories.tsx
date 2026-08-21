import type { Meta, StoryObj } from "@storybook/nextjs";
import { CustomSkeleton } from "./skeleton";

const meta = {
  title: "Shared/Skeleton",
  component: CustomSkeleton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CustomSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
