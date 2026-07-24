import { NextIcon } from "@/shared/icons/24";
import { Typography } from "@/shared";

import { ChatMessage } from "./chat-message";

interface RoomChatProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  user: {
    name: string;
    avatarColor: string;
  };
  text: string;
  timestamp?: string;
}

const mockMessages: Message[] = [
  {
    id: "1",
    user: {
      name: "Victor Wolf",
      avatarColor: "bg-red-600",
    },
    text: "Amazing, greetings from Italy!",
  },
  {
    id: "2",
    user: {
      name: "Sarah Johnson",
      avatarColor: "bg-blue-600",
    },
    text: "Hello everyone! Great to be here.",
  },
  {
    id: "3",
    user: {
      name: "Michael Chen",
      avatarColor: "bg-green-600",
    },
    text: "This is awesome! 🎉",
  },
  {
    id: "4",
    user: {
      name: "Emma Wilson",
      avatarColor: "bg-purple-600",
    },
    text: "Can't wait to start the session!",
  },
  {
    id: "5",
    user: {
      name: "Victor Wolf",
      avatarColor: "bg-red-600",
    },
    text: "Amazing, greetings from Italy!",
  },
];

export default function RoomChat({ isOpen, onClose }: RoomChatProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-22.5 px-6 py-7 pt-8 right-16 z-20 w-87.5 h-[calc(100%-120px)] bg-(--color-surface-contrast) rounded-3xl shadow-xl flex flex-col">
      <div className="flex items-center justify-between gap-11 pb-6.5 border-b border-(--color-surface-strong) border-opacity-15 flex-shrink-0">
        <div className="flex items-center">
          <Typography variant="h3" className="text-[22px]">
            Live chat
          </Typography>
          <Typography className="ml-6" variant="body">
            Participants ({mockMessages.length})
          </Typography>
        </div>
        <button onClick={onClose}>
          <NextIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <div className="space-y-4">
          {mockMessages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      </div>
      <div className="bg-(--color-chat-input) rounded-[17px] border-t border-(--color-surface-strong) border-opacity-15 flex-shrink-0">
        <input
          type="text"
          placeholder="Write your message"
          className="w-full h-full py-5.25 px-2 outline-0 text-(--color-text) bg-transparent"
        />
      </div>
    </div>
  );
}
