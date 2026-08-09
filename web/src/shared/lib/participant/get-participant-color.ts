import { PARTICIPANT_COLORS } from "./participant-colors";

export function getParticipantColor(id: string) {
  let hash = 0;

  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return PARTICIPANT_COLORS[hash % PARTICIPANT_COLORS.length];
}
