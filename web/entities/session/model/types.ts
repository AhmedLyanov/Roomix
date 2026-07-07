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
