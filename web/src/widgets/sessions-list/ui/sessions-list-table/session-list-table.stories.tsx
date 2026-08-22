import type { Meta, StoryObj } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { Session } from "@/src/entities/session";
import { SessionsListTable } from "./sessions-list-table";

const userId = "user-1";

const mockSession: Session = {
  _id: "session-1",
  roomId: "room-1",
  ownerId: userId,
  ownerName: "Ahmed",
  startedAt: "2026-08-22T09:30:00.000Z",
  endedAt: "2026-08-22T10:42:05.000Z",
  duration: 4325,
  participants: [
    {
      userId: "user-1",
      userName: "Ahmed",
      language: "en",
    },
    {
      userId: "user-2",
      userName: "John",
      language: "en",
    },
  ],
};

const meta = {
  title: "widgets/sessions-list/sessions-list-table",
  component: SessionsListTable,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: Infinity,
          },
        },
      });

      queryClient.setQueryData<Session[]>(["sessions", userId], [mockSession]);

      return (
        <QueryClientProvider client={queryClient}>
          <div className="w-full max-w-8xl">
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof SessionsListTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSession: Story = {
  args: {
    userId,
  },
};
