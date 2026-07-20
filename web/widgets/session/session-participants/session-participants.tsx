import { Button, Typography } from "@/shared/";
import ParticipantItem from "./participant-item";

export default function SessionParticipants() {
  return (
    <div className="rounded-lg bg-(--table-meta-bg) p-5">
      <Typography variant="caption" className="text-[17px]">
        Participants (4)
      </Typography>
      <div className="pt-2">
        <ParticipantItem />
        <ParticipantItem />
        <ParticipantItem />
        <ParticipantItem />
      </div>
      <div className="pt-7.5">
        <Button variant="ghost" className="font-normal">
          View all participants
        </Button>
      </div>
    </div>
  );
}
