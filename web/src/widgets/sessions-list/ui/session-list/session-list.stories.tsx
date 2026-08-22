import type { Meta, StoryObj } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { Session } from "@/src/entities/session";

import { SessionsList } from "./sessions-list";

const userId = "user-1";

const mockSessions: Session[] = [
  {
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
  },
  {
    _id: "session-2",
    roomId: "room-2",
    ownerId: userId,
    ownerName: "Ahmed",
    startedAt: "2026-08-21T14:10:00.000Z",
    endedAt: "2026-08-21T15:05:30.000Z",
    duration: 3330,
    participants: [
      {
        userId: "user-1",
        userName: "Ahmed",
        language: "en",
      },
      {
        userId: "user-3",
        userName: "Mike",
        language: "en",
      },
    ],
  },
];

const createQueryClient = (sessions: Session[]) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  queryClient.setQueryData<Session[]>(["sessions", userId], sessions);

  return queryClient;
};

const meta = {
  title: "widgets/sessions-list",
  component: SessionsList,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story, context) => {
      const sessions = context.parameters.sessions ?? [];

      const queryClient = createQueryClient(sessions);

      return (
        <QueryClientProvider client={queryClient}>
          <div className="w-full max-w-5xl p-8">
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof SessionsList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    userId,
  },
  parameters: {
    sessions: [],
  },
};

export const WithSessions: Story = {
  args: {
    userId,
  },
  parameters: {
    sessions: mockSessions,
  },
};
