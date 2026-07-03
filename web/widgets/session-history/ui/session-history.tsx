import { SessionHistoryTabs } from "./session-history-tabs";
import { SessionHistoryTable } from "./session-history-table";

export function SessionHistory() {
  return (
    <section className="flex flex-col gap-10">
      <SessionHistoryTabs />

      <SessionHistoryTable />
    </section>
  );
}