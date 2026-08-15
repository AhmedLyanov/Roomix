import type Peer from "simple-peer";

export interface SubtitleData {
  originalText: string;
  translatedText: string;
  speakerId: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
}

export interface SubtitlePayload {
  originalText: string;
  translatedText: string;
  speakerId: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface UseRoomSessionProps {
  roomId: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  nativeLanguage: string;
}

export interface Participant {
  userId: string;
  userName: string;
  userAvatar?: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
}

export interface UserData {
  socketId: string;
  userName: string;
  userAvatar?: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
}
export interface ExistingUsersPayload {
  users: UserData[];
}

export interface OfferPayload {
  offer: Peer.SignalData;
  from: string;
}

export interface AnswerPayload {
  answer: Peer.SignalData;
  from: string;
}

export interface IceCandidatePayload {
  candidate: Peer.SignalData;
  from: string;
}

export interface UserConnectedPayload {
  socketId: string;
  userName: string;
  userAvatar?: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
}
export interface UserDisconnectedPayload {
  socketId: string;
}

export interface JoinRoomPayload {
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  nativeLanguage: string;
}

export type SignalType = "offer" | "answer" | "ice-candidate";

export interface SignalData {
  type: SignalType;
  data: Peer.SignalData;
  to: string;
}
export interface CameraUpdatePayload {
  socketId: string;
  enabled: boolean;
}

export interface MicrophoneUpdatePayload {
  socketId: string;
  enabled: boolean;
}
