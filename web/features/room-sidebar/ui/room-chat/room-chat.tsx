import { NextIcon } from "@/shared/icons/24";
import { Typography, Spinner } from "@/shared";
import { useEffect, useState } from "react";
import { RoomMessage, getRoomMessages } from "@/entities/message";
import { ChatMessage } from "./chat-message";

import { Socket } from "socket.io-client";

interface RoomChatProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;

  roomSession: {
    socketRef: React.MutableRefObject<Socket | null>;
    sendMessage: (text: string) => void;
  };
}

export default function RoomChat({
  roomId,
  isOpen,
  onClose,
  roomSession,
}: RoomChatProps) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!roomId || !isOpen) return;

    const loadMessages = async () => {
      try {
        setLoading(true);
        const data = await getRoomMessages(roomId);
        setMessages(data);
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [roomId, isOpen]);

  useEffect(() => {
    if (!roomSession.socketRef.current) return;

    const socket = roomSession.socketRef.current;

    const handleNewMessage = (message: RoomMessage) => {
      setMessages((prev) => [...prev, message]);
    };

    socket.on("chat:new", handleNewMessage);

    return () => {
      socket.off("chat:new", handleNewMessage);
    };
  }, [roomSession.socketRef]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-22.5 px-6 py-7 pt-8 right-16 z-20 w-87.5 h-[calc(100%-120px)] bg-(--color-surface-contrast) rounded-3xl shadow-xl flex flex-col">
      <div className="flex items-center justify-between gap-11 pb-6.5 border-b border-(--color-surface-strong) border-opacity-15 flex-shrink-0">
        <div className="flex items-center">
          <Typography variant="h3" className="text-[22px]">
            Live chat
          </Typography>
          <Typography className="ml-6" variant="body">
            Participants ({messages.length})
          </Typography>
        </div>
        <button onClick={onClose}>
          <NextIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Typography variant="body" className="text-(--color-gray-light)">
              No messages yet
            </Typography>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message._id} message={message} />
            ))}
          </div>
        )}
      </div>
      <div className="bg-(--color-chat-input) rounded-[17px] border-t border-(--color-surface-strong) border-opacity-15 flex-shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              roomSession.sendMessage(text);
              setText("");
            }
          }}
          type="text"
          placeholder="Write your message"
          className="w-full h-full py-5.25 px-2 outline-0 text-(--color-text) bg-transparent"
        />
      </div>
    </div>
  );
}
