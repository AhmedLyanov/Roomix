"use client";

import { useUser } from "@clerk/nextjs";

import { Typography } from "@/shared";
import { BroadcastIcon, LessonIcon, MeetingIcon } from "@/shared/icons/24";

import { SessionModeCard, useCreateSession } from "@/features/create-lesson";

import { SessionsList } from "@/widgets/sessions-list";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();

  const { createSession } = useCreateSession();

  if (!isLoaded || !user) {
    return null;
  }

  return (
    <section className="w-full px-9.25">
      <div className="mt-25 w-full px-9.5">
        <Typography variant="h1">Cyber modes</Typography>

        <div className="mt-14.25">
          <div className="mt-14 grid grid-cols-3 gap-5">
            <SessionModeCard
              icon={<MeetingIcon />}
              title="Meeting"
              onClick={createSession}
            />

            <SessionModeCard icon={<LessonIcon />} title="Active lesson" />

            <SessionModeCard icon={<BroadcastIcon />} title="Broadcast" />
          </div>
        </div>
      </div>

      <div className="mt-15.75">
        <SessionsList userId={user.id} />
      </div>
    </section>
  );
}
