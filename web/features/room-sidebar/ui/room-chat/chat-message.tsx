import { Typography } from "@/shared";
import { FileItem, getFileExtension } from "@/entities/file";
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
    <div className="flex gap-3">
      {message.senderAvatar ? (
        <img
          src={message.senderAvatar}
          alt={message.senderName}
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className={`h-10 w-10 ${getAvatarColor(
            message.senderId,
          )} flex-shrink-0 rounded-full flex items-center justify-center text-white font-semibold`}
        >
          {getInitials(message.senderName)}
        </div>
      )}

      <div className="min-w-0">
        <Typography className="font-semibold">{message.senderName}</Typography>

        {message.type === "text" && <Typography>{message.text}</Typography>}

        {message.type === "file" && message.file && (
          <div className="mt-2">
            <FileItem
              file={{
                id: message._id,
                name: message.file.originalName,
                size: message.file.size,
                extension: getFileExtension(message.file.originalName),
                uploadedAt: message.createdAt,
              }}
              onDownload={() => {
                window.open(
                  `${process.env.NEXT_PUBLIC_API_URL}${message.file!.url}`,
                  "_blank",
                );
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
