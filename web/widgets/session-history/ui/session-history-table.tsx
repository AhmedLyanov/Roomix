import { useSessions, useDeleteSession } from "@/entities/session";

import { Typography, Spinner } from "@/shared";
import { ActionDeleteIcon, ActionPlayIcon } from "@/shared/icons/24";

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
          <div
            key={session._id}
            className="
              grid
              grid-cols-[36%_36%_18%_10%]
              items-center
              border-b border-(--primary-border)
              px-9.5
              py-6
            "
          >
            <Typography className="text-(--table-meta-data)">
              Session #{sessions.length - index}
            </Typography>

            <div className="flex items-center gap-2">
              <Typography className="text-(--table-meta-data)">
                {new Date(session.startedAt).toLocaleDateString()}
              </Typography>

              <Typography>/</Typography>

              <Typography className="text-(--table-meta-text)">
                {new Date(session.startedAt).toLocaleTimeString()}
              </Typography>
            </div>

            <Typography className="text-(--table-meta-text)">
              {session.duration}s
            </Typography>

            <div className="flex items-center gap-6">
              <button>
                <ActionPlayIcon />
              </button>

              <button
                onClick={() => deleteMutation.mutate(session._id)}
                className="transition-opacity hover:opacity-70"
              >
                <ActionDeleteIcon />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
