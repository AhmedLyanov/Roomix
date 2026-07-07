import { SessionHistoryTabs } from "./session-history-tabs";
import { SessionHistoryTable } from "./session-history-table";

interface Props {
  userId: string;
}

export function SessionHistory({ userId }: Props) {
  return (
    <section className="flex flex-col gap-10">
      <SessionHistoryTabs />

      <SessionHistoryTable userId={userId} />
    </section>
  );
}
