export type RoomMessageType = "text" | "system" | "image" | "file";

export interface RoomMessageFile {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface RoomMessage {
  _id: string;
  roomId: string;

  senderId: string;
  senderName: string;
  senderAvatar: string;

  text: string;

  type: RoomMessageType;

  file?: RoomMessageFile;

  createdAt: string;
  updatedAt: string;
}
