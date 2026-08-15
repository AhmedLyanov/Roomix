import { Typography } from "@/src/shared";
import type { SessionParticipant } from "@/src/entities/session";

interface Props {
  participant: SessionParticipant;
}

export default function ParticipantItem({ participant }: Props) {
  const initials = participant.userName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="flex items-center gap-3 rounded-lg py-3">
      {participant.userAvatar ? (
        <img
          src={participant.userAvatar}
          alt={participant.userName}
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-(--color-accent) text-sm font-bold text-white">
          {initials}
        </div>
      )}

      <div className="min-w-0">
        <Typography variant="caption" className="text-[17px]">
          {participant.userName}
        </Typography>

        {participant.language && (
          <Typography variant="body" className="text-(--color-gray)">
            {participant.language.toUpperCase()}
          </Typography>
        )}
      </div>
    </article>
  );
}
