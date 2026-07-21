import { Button, Typography } from "@/shared";

import ParticipantItem from "./participant-item/participant-item";

import { Session } from "@/entities/session";

interface Props {
  session: Session;
}

export default function SessionParticipants({ session }: Props) {
  return (
    <div className="rounded-lg bg-(--table-meta-bg) p-5">
      <Typography variant="caption" className="text-[17px]">
        Participants ({session.participants.length})
      </Typography>

      <div className="pt-2">
        {session.participants.map((participant) => (
          <ParticipantItem key={participant.userId} participant={participant} />
        ))}
      </div>

      {session.participants.length > 4 && (
        <div className="pt-7.5">
          <Button variant="ghost" className="font-normal">
            View all participants
          </Button>
        </div>
      )}
    </div>
  );
}
