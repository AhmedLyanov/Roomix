import { Typography } from "@/shared";
import { RoomMessage } from "@/entities/message";

interface ChatMessageProps {
  message: RoomMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (senderId: string) => {
    const colors = [
      "bg-red-600",
      "bg-blue-600",
      "bg-green-600",
      "bg-purple-600",
      "bg-yellow-600",
      "bg-pink-600",
      "bg-indigo-600",
      "bg-teal-600",
    ];
    const index = senderId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div className="flex items-start">
      <div
        className={`w-10 h-10 ${getAvatarColor(message.senderId)} rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm`}
      >
        {getInitials(message.senderName)}
      </div>
      <div className="ml-4 flex-1">
        <Typography variant="body" className="text-[14px] font-semibold">
          {message.senderName}
        </Typography>
        <Typography variant="caption">{message.text}</Typography>
      </div>
    </div>
  );
}
