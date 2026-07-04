"use client";

import { useRouter } from "next/navigation";

import { Typography } from "@/shared";
import {
  MeetingIcon,
  LessonIcon,
  BroadcastIcon,
} from "@/shared/icons/24";

import { SessionModeCard } from "@/features/create-lesson";
import { SessionHistory } from "@/widgets/session-history";

export default function Home() {
  const router = useRouter();

  const handleCreateMeeting = () => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 9);

    const storedName = sessionStorage.getItem("userName");

    if (!storedName) {
      sessionStorage.setItem(
        "userName",
        `User ${Math.floor(Math.random() * 1000)}`,
      );
    }

    router.push(`/room/${id}`);
  };

  return (
    <section className="w-full px-9.25">
      <div className="mt-25 w-full px-9.5">
        <Typography variant="h1">
          Cyber modes
        </Typography>

        <div className="mt-14.25">
          <div className="mt-14 grid grid-cols-3 gap-5">
            <SessionModeCard
              icon={<MeetingIcon />}
              title="Meeting"
              onClick={handleCreateMeeting}
            />

            <SessionModeCard
              icon={<LessonIcon />}
              title="Active lesson"
            />

            <SessionModeCard
              icon={<BroadcastIcon />}
              title="Broadcast"
            />
          </div>
        </div>
      </div>

      <div className="mt-15.75">
        <SessionHistory />
      </div>
    </section>
  );
}