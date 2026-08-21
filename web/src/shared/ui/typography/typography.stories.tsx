import type { Meta, StoryObj } from "@storybook/nextjs";
import { Typography } from "./typography";

const meta = {
  title: "Shared/Typography",
  component: Typography,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["h1", "h2", "h3", "body", "caption", "label", "navigation"],
      description: "Вариант типографики",
    },
    className: {
      control: "text",
      description: "Дополнительные CSS-классы",
    },
    children: {
      control: "text",
      description: "Текст",
    },
  },
} satisfies Meta<typeof Typography>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: "body",
    children: "Typography component",
  },
};

export const Heading: Story = {
  args: {
    variant: "h1",
    children: "Heading",
  },
};

export const Caption: Story = {
  args: {
    variant: "caption",
    children: "Caption text",
  },
};

export const Navigation: Story = {
  args: {
    variant: "navigation",
    children: "Navigation",
  },
};
