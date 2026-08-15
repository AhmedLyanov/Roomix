export interface SessionParticipant {
  userId: string;
  userName: string;
  userAvatar?: string;
  language?: string;
}

export interface Session {
  _id: string;
  roomId: string;

  ownerId: string;
  ownerName: string;

  startedAt: string;
  endedAt: string;

  duration: number;

  participants: SessionParticipant[];
}
