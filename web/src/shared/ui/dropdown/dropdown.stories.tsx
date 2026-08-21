import type { Meta, StoryObj } from "@storybook/nextjs";
import { Dropdown } from "./dropdown";

const meta = {
  title: "Shared/Dropdown",
  component: Dropdown,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
    },
  },
} satisfies Meta<typeof Dropdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    trigger: (open) => (
      <button className="rounded-lg bg-(--button-primary-bg) px-5 py-3 text-white">
        {open ? "Close" : "Channels"}
      </button>
    ),

    children: (
      <div className="flex flex-col gap-1 p-2">
        <button className="rounded-lg px-4 py-2 text-left text-white hover:bg-(--button-hover-bg)">
          Профиль
        </button>

        <button className="rounded-lg px-4 py-2 text-left text-white hover:bg-(--button-hover-bg)">
          Настройки
        </button>

        <button className="rounded-lg px-4 py-2 text-left text-white hover:bg-(--button-hover-bg)">
          Выйти
        </button>
      </div>
    ),

    className: "Channels",
  },
};
