import {
  useSessions,
  useDeleteSession,
  SessionHistoryItem,
} from "@/entities/session";

import { Typography, Spinner } from "@/shared";

interface Props {
  userId: string;
}

export function SessionHistoryTable({ userId }: Props) {
  const { data: sessions = [], isLoading } = useSessions(userId);
  const deleteMutation = useDeleteSession(userId);

  if (isLoading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Typography variant="body" className="text-(--table-meta-text)">
          {"You don't have any session history yet."}
        </Typography>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-[36%_36%_18%_10%] rounded-lg bg-(--table-meta-bg) px-9.5 py-4">
        <Typography variant="caption" className="text-(--table-meta-text)">
          Name
        </Typography>

        <Typography variant="caption" className="text-(--table-meta-text)">
          Date
        </Typography>

        <Typography variant="caption" className="text-(--table-meta-text)">
          Duration
        </Typography>

        <Typography variant="caption" className="text-(--table-meta-text)">
          Actions
        </Typography>
      </div>

      <div className="flex flex-col">
        {sessions.map((session, index) => (
          <SessionHistoryItem
            key={session._id}
            session={session}
            index={index}
            total={sessions.length}
            onDelete={deleteMutation.mutate}
          />
        ))}
      </div>
    </div>
  );
}
