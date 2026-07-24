export type RoomMessageType = "text" | "system" | "image" | "file";

export interface RoomMessage {
  _id: string;

  roomId: string;

  senderId: string;

  senderName: string;

  text: string;

  type: RoomMessageType;

  createdAt: string;

  updatedAt: string;
}
