"use client";

import { useParams } from "next/navigation";

import {
  SessionOverview,
  SessionTimeline,
  SessionParticipants,
  SessionAi,
  SessionFiles,
  SessionActions,
  SessionChat,
} from "@/src/widgets/session";
import { ErrorSession } from "@/src/shared/icons/24";

import { Spinner, Typography, Button } from "@/src/shared";
import { useSession } from "@/src/entities/session";
import Link from "next/link";

export default function SessionPage() {
  const { sessionId } = useParams<{
    sessionId: string;
  }>();

  const sessionNumber = "7676";

  const { data: session, isLoading, isError } = useSession(sessionId);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex max-w-md flex-col items-center text-center">
          <div
            className="
            mb-6
            flex
            h-20
            w-20
            items-center
            justify-center
  
          "
          >
            <ErrorSession className="h-20 w-20" />
          </div>

          <Typography variant="h2" className="mb-2">
            Session not found
          </Typography>

          <Typography variant="body" className="text-(--color-gray)">
            This session does not exist or may have been deleted.
          </Typography>
          <Link href="/" className="pt-2">
            <Button variant="ghost" className="text-(--color-gray)">
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-[30px] py-[30px]">
      <SessionOverview session={sessionNumber} />

      <div className="pt-2">
        <SessionTimeline session={session} />

        <div className="grid grid-cols-3 gap-2 pt-2">
          <SessionParticipants session={session} />
          <SessionAi />
          <SessionFiles roomId={session.roomId} />
        </div>

        <div className="pt-2 grid grid-cols-2 gap-2">
          <div className="h-[calc(100vh-420px)] min-h-[400px]">
            <SessionActions sessionId={session._id} />
          </div>
          <div className="h-[calc(100vh-420px)] min-h-[400px]">
            <SessionChat session={session} />
          </div>
        </div>
      </div>
    </div>
  );
}
