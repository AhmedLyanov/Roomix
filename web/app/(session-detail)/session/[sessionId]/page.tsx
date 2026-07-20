import {
  SessionOverview,
  SessionTimeline,
  SessionParticipants,
  SessionAi,
  SessionFiles,
  SessionActions,
  SessionInfo,
} from "@/widgets/session";

export default function SessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const sessionId = params.sessionId;
  const session = "#151";

  return (
    <div className="px-[30px] py-[30px]">
      <SessionOverview session={session} />

      <div className="pt-2">
        <SessionTimeline />

        <div className="grid grid-cols-3 gap-2 pt-2">
          <SessionParticipants />
          <SessionAi />
          <SessionFiles />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <SessionActions />
          <SessionInfo />
        </div>
      </div>
    </div>
  );
}
