export interface Session {
  _id: string;
  roomId: string;

  ownerId: string;
  ownerName: string;

  startedAt: string;
  endedAt: string;

  duration: number;

  participants: {
    userId: string;
    userName: string;
  }[];
}
export interface Participant {
  _id: string;

  userId: string;
  userName: string;
  userAvatar: string;
  avatar: string;
  language: string;

  joinedAt: string;
  leftAt?: string;
}
