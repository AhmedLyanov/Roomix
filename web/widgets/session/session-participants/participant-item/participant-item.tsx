import { Typography } from "@/shared";
import { Participant } from "@/entities/session";

interface Props {
  participant: Participant;
}

export default function ParticipantItem({ participant }: Props) {
  return (
    <article className="flex items-center gap-3 rounded-lg py-3">
      {participant.userAvatar ? (
        <img
          src={participant.userAvatar}
          alt={participant.userName}
          className="h-10 w-10 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--color-accent) text-sm font-bold text-white flex-shrink-0">
          {participant.userName
            .split(" ")
            .map((word) => word[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
      )}

      <div>
        <Typography variant="caption" className="text-[17px]">
          {participant.userName}
        </Typography>

        <Typography variant="body" className="text-(--color-gray)">
          {participant.language.toUpperCase()}
        </Typography>
      </div>
    </article>
  );
}
