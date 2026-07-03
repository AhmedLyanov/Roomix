import { Typography } from "@/shared";
import { MeetingIcon, LessonIcon, BroadcastIcon } from "@/shared/icons/24/";
import { SessionModeCard } from "@/features/create-lesson";
import { SessionHistory } from "@/widgets/session-history";

export default function Home() {
  return (
    <section className="w-full  px-9.25">
      <div className="w-full mt-25 px-9.5">
        <Typography variant="h1">Cyber modes</Typography>
        <div className="mt-14.25">
          <div className="grid grid-cols-3 gap-5 mt-14">
            <SessionModeCard icon={<MeetingIcon />} title="Meeting" />

            <SessionModeCard icon={<LessonIcon />} title="Active lesson" />

            <SessionModeCard icon={<BroadcastIcon />} title="Broadcast" />
          </div>
        </div>
      </div>
      <div className="mt-15.75">
        <SessionHistory />
      </div>
    </section>
  );
}
