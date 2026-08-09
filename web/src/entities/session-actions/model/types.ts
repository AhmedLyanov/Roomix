export type SessionActionType =
  | "SESSION_STARTED"
  | "SESSION_ENDED"
  | "PARTICIPANT_JOINED"
  | "PARTICIPANT_LEFT"
  | "FILE_UPLOADED"
  | "MESSAGE_SENT"
  | "SCREEN_SHARED";

export interface SessionAction {
  _id: string;

  sessionId: string;

  type: SessionActionType;

  userId?: string;

  metadata: {
    ownerName?: string;
    userName?: string;
    fileName?: string;
    messageId?: string;
  };

  createdAt: string;
}
