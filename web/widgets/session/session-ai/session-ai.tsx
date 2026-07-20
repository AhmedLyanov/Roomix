import { Typography, Badge } from "@/shared/";

export default function SessionAi() {
  return (
    <div className="rounded-lg bg-(--table-meta-bg) p-5">
      <Typography variant="caption" className="text-[17px]">
        AI Summary
      </Typography>
      <div className="">
        <Typography variant="body" className="pt-2 text-[17px]">
          We discussed the current progress of the new design system project.
          The main components and color palette were approved. Sophie will
          update the documentation and mockups by next week. Michael takes
          responsibility for roles and system integrations. We also discussed
          upcoming tasks and priorities for the sprint.
        </Typography>
        <Typography variant="body" className="pt-4 text-[17px]">
          Key topics:
        </Typography>
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge badge="Design System" />
          <Badge badge="UX Design" />
          <Badge badge="UI/UX Design" />
          <Badge badge="Research" />
        </div>
      </div>
    </div>
  );
}
