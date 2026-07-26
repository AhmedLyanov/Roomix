import { Typography } from "@/shared/";
import { Session } from "@/entities/session";
import { formatSessionDuration } from "@/shared/lib/";

interface Props {
  session?: Session;
}

export default function SessionTimeline({ session }: Props) {
  if (!session) {
    return (
      <div className="flex justify-between items-center gap-8 bg-(--table-meta-bg) px-9.5 py-4 rounded-lg">
        <div>
          <Typography
            variant="body"
            className="text-(--table-meta-text) text-sm"
          >
            Duration
          </Typography>
        </div>
        <div>
          <Typography
            variant="body"
            className="text-(--table-meta-text) text-sm"
          >
            Started
          </Typography>
        </div>
        <div>
          <Typography
            variant="body"
            className="text-(--table-meta-text) text-sm"
          >
            Finished
          </Typography>
        </div>
        <div>
          <Typography
            variant="body"
            className="text-(--table-meta-text) text-sm"
          >
            Participants
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center gap-8 bg-(--table-meta-bg) px-9.5 py-4 rounded-lg">
      <div>
        <Typography variant="body" className="text-(--table-meta-text) text-sm">
          Duration
        </Typography>
        <Typography className="text-[18px] font-medium" variant="caption">
          {formatSessionDuration(session.duration || 0)}
        </Typography>
      </div>
      <div>
        <Typography variant="body" className="text-(--table-meta-text) text-sm">
          Started
        </Typography>
        <Typography className="text-[18px] font-medium" variant="caption">
          {new Date(session.startedAt).toLocaleString()}
        </Typography>
      </div>
      <div>
        <Typography variant="body" className="text-(--table-meta-text) text-sm">
          Finished
        </Typography>
        <Typography className="text-[18px] font-medium" variant="caption">
          {session.endedAt ? new Date(session.endedAt).toLocaleString() : "—"}
        </Typography>
      </div>
      <div>
        <Typography variant="body" className="text-(--table-meta-text) text-sm">
          Participants
        </Typography>
        <Typography className="text-[18px] font-medium" variant="caption">
          {session.participants?.length || 0}
        </Typography>
      </div>
    </div>
  );
}
