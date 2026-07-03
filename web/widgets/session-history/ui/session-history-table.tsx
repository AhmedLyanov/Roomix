const sessions = [
  {
    id: 1,
    name: "Session 12",
    date: "25.01.2022",
    time: "10:26 PM",
    duration: "1:32:56",
  },
  {
    id: 2,
    name: "Session 11",
    date: "24.01.2022",
    time: "10:15 PM",
    duration: "0:32:56",
  },
  {
    id: 3,
    name: "Session 10",
    date: "18.01.2022",
    time: "10:26 PM",
    duration: "2:32:56",
  },
];
import { Typography } from "@/shared";
import { ActionPlayIcon, ActionDeleteIcon } from "@/shared/icons/24";

export function SessionHistoryTable() {
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
        {sessions.map((session) => (
          <div
            key={session.id}
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
              {session.name}
            </Typography>

            <div className="flex items-center gap-2">
              <Typography className="text-(--table-meta-data)">
                {session.date}
              </Typography>

              <Typography className="text-(--table-meta-data)">/</Typography>

              <Typography className="text-(--table-meta-text)">
                {session.time}
              </Typography>
            </div>

            <Typography className="text-(--table-meta-text)">
              {session.duration}
            </Typography>

            <div className="flex items-center gap-6">
              <button
                className="transition-opacity hover:opacity-70"
                aria-label="Play session"
              >
                <ActionPlayIcon />
              </button>

              <button
                className="transition-opacity hover:opacity-70"
                aria-label="Delete session"
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
