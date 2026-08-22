"use client";

import { NextIcon, SendMessage } from "@/src/shared/icons/24";

import { UploadFileButton } from "@/src/features/upload-file";

import { Typography, Spinner } from "@/src/shared";

import { useEffect, useMemo, useState } from "react";

import { RoomMessage, getRoomMessages } from "@/src/entities/message";

import { ChatMessage } from "./chat-message";

interface RoomChatProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;

  roomSession: {
    messages: RoomMessage[];
    sendMessage: (text: string) => void;
  };
}

export default function RoomChat({
  roomId,
  isOpen,
  onClose,
  roomSession,
}: RoomChatProps) {
  const [historyMessages, setHistoryMessages] = useState<RoomMessage[]>([]);

  const [loading, setLoading] = useState(true);

  const [text, setText] = useState("");

  useEffect(() => {
    if (!roomId || !isOpen) {
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        setLoading(true);

        const data = await getRoomMessages(roomId);

        if (!cancelled) {
          setHistoryMessages(data);
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [roomId, isOpen]);

  const messages = useMemo(() => {
    const map = new Map<string, RoomMessage>();

    for (const message of historyMessages) {
      map.set(message._id, message);
    }

    for (const message of roomSession.messages) {
      map.set(message._id, message);
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [historyMessages, roomSession.messages]);

  const handleSendMessage = () => {
    const value = text.trim();

    if (!value) {
      return;
    }

    roomSession.sendMessage(value);

    setText("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSendMessage();
    }
  };

  if (!isOpen) {
    return null;
  }

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
        <div className="flex items-center gap-2 px-4">
          <UploadFileButton roomId={roomId} />

          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            type="text"
            placeholder="Write your message"
            className="w-full h-full py-5.25 outline-0 text-(--color-text) bg-transparent"
          />

          <button
            className="flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSendMessage}
            disabled={!text.trim()}
          >
            <SendMessage />
          </button>
        </div>
      </div>
    </div>
  );
}
