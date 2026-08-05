import { Typography } from "@/shared";
import { RoomMessage, getRoomMessages } from "@/entities/message";
import { Session } from "@/entities/session";
import { useEffect, useState } from "react";
import { MessageNone } from "@/shared/icons/24";

interface Props {
  session: Session;
}

function ChatMessage({ message }: { message: RoomMessage }) {
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
    <div className="flex items-start mb-4">
      {message.senderAvatar ? (
        <img
          src={message.senderAvatar}
          alt={message.senderName}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div
          className={`w-10 h-10 ${getAvatarColor(message.senderId)} rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}
        >
          {getInitials(message.senderName)}
        </div>
      )}
      <div className="ml-4 flex-1">
        <div className="flex items-baseline gap-2">
          <Typography variant="body" className="text-[14px] font-semibold">
            {message.senderName}
          </Typography>
        </div>
        <Typography variant="caption">{message.text}</Typography>
      </div>
    </div>
  );
}

export default function SessionChat({ session }: Props) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session.roomId) return;

    const loadMessages = async () => {
      try {
        setLoading(true);
        const data = await getRoomMessages(session.roomId);
        setMessages(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [session.roomId]);

  return (
    <div className="rounded-xl bg-(--table-meta-bg) p-6">
      <div>
        <div className="mb-8">
          <Typography variant="caption" className="text-[17px]">
            Chat
          </Typography>
        </div>
        <div>
          <div className="max-h-[400px] overflow-y-auto pr-2">
            {loading ? (
              <div className="flex flex-col gap-4 py-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-start">
                    <div className="w-10 h-10 rounded-full bg-(--color-surface-strong) animate-pulse shrink-0" />
                    <div className="ml-4 flex-1 space-y-2">
                      <div className="h-4 w-32 bg-(--color-surface-strong) animate-pulse rounded" />
                      <div className="h-3 w-48 bg-(--color-surface-strong) animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <MessageNone className="w-16 h-16 text-(--color-gray) mb-3" />
                <Typography variant="body" className="text-(--color-gray)">
                  No messages
                </Typography>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage key={message._id} message={message} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
