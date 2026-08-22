import type { Meta, StoryObj } from "@storybook/nextjs";

import { SessionsListTabs } from "./sessions-list-tabs";

const meta = {
  title: "widgets/sessions-list/sessions-list-tabs",
  component: SessionsListTabs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SessionsListTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
