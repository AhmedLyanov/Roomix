import Link from "next/link";

import { Typography } from "@/shared";
import { ActionDeleteIcon, ActionPlayIcon } from "@/shared/icons/24";
import { formatSessionDuration } from "@/shared/lib/";

import type { Session } from "../model/types";

interface SessionHistoryItemProps {
  session: Session;
  index: number;
  total: number;
  onDelete: (id: string) => void;
}

export function SessionHistoryItem({
  session,
  index,
  total,
  onDelete,
}: SessionHistoryItemProps) {
  return (
    <Link
      href={`/session/${session._id}`}
      className="
        grid
        grid-cols-[36%_36%_18%_10%]
        items-center
        border-b
        hover:bg-(--table-meta-bg)
        hover:cursor-pointer
        border-(--primary-border)
        px-9.5
        py-6
      "
    >
      <Typography className="text-(--table-meta-data)">
        Session #{total - index}
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
        {formatSessionDuration(session.duration)}
      </Typography>

      <div className="flex items-center gap-6">
        <button>
          <ActionPlayIcon />
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            onDelete(session._id);
          }}
          className="transition-opacity hover:opacity-70"
        >
          <ActionDeleteIcon />
        </button>
      </div>
    </Link>
  );
}
