import { Typography } from "@/shared/";

export default function SessionTimeline() {
  return (
    <div className="flex justify-between items-center gap-8 bg-(--table-meta-bg) px-9.5 py-4 rounded-lg [&>*:not(:last-child)]:after:content-['|'] [&>*:not(:last-child)]:after:ml-8 [&>*:not(:last-child)]:after:text-(--table-meta-text)">
      <div>
        <Typography variant="body" className="text-(--table-meta-text) text-sm">
          Duration
        </Typography>
        <Typography className="text-[18px] font-medium" variant="caption">
          2h 00m 22s
        </Typography>
      </div>
      <div>
        <Typography variant="body" className="text-(--table-meta-text) text-sm">
          Started
        </Typography>
        <Typography className="text-[18px] font-medium" variant="caption">
          Jul 19, 2024 11:59:23 PM
        </Typography>
      </div>
      <div>
        <Typography variant="body" className="text-(--table-meta-text) text-sm">
          Finished
        </Typography>
        <Typography className="text-[18px] font-medium" variant="caption">
          Jul 20, 2024 1:59:45 AM
        </Typography>
      </div>
      <div>
        <Typography variant="body" className="text-(--table-meta-text) text-sm">
          Participants
        </Typography>
        <Typography className="text-[18px] font-medium" variant="caption">
          4
        </Typography>
      </div>
    </div>
  );
}
