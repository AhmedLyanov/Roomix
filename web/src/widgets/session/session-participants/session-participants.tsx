import { Button, Typography } from "@/src/shared";

import ParticipantItem from "./participant-item/participant-item";

import { Session } from "@/src/entities/session";

interface Props {
  session: Session;
}

function ParticipantSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-10 h-10 rounded-full bg-(--color-surface-strong) animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-(--color-surface-strong) animate-pulse rounded" />
        <div className="h-3 w-20 bg-(--color-surface-strong) animate-pulse rounded" />
      </div>
    </div>
  );
}

export default function SessionParticipants({ session }: Props) {
  const isLoading = !session?.participants;

  return (
    <div className="rounded-lg bg-(--table-meta-bg) p-5">
      <Typography variant="caption" className="text-[17px]">
        Participants ({isLoading ? "..." : session.participants.length})
      </Typography>

      <div className="pt-2">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <ParticipantSkeleton key={i} />
            ))}
          </>
        ) : (
          session.participants.map((participant) => (
            <ParticipantItem
              key={participant.userId}
              participant={participant}
            />
          ))
        )}
      </div>

      {!isLoading && session.participants.length > 4 && (
        <div className="pt-7.5">
          <Button variant="ghost" className="font-normal">
            View all participants
          </Button>
        </div>
      )}
    </div>
  );
}
