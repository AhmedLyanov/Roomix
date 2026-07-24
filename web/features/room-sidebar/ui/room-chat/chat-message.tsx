import { Typography } from "@/shared";

interface ChatMessageProps {
  message: {
    id: string;
    user: {
      name: string;
      avatarColor: string;
    };
    text: string;
    timestamp?: string;
  };
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className="flex items-start">
      <div
        className={`w-10 h-10 ${message.user.avatarColor} rounded-full flex-shrink-0`}
      />
      <div className="ml-4 flex-1">
        <Typography variant="body" className="text-[14px]">
          {message.user.name}
        </Typography>
        <Typography variant="caption">{message.text}</Typography>
        {message.timestamp && (
          <Typography
            variant="caption"
            className="text-(--color-gray-light) text-[10px] mt-1 block"
          >
            {message.timestamp}
          </Typography>
        )}
      </div>
    </div>
  );
}
