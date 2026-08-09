import { SessionsListTabs } from "./sessions-list-tabs";
import { SessionsListTable } from "./sessions-list-table";

interface Props {
  userId: string;
}

export function SessionsList({ userId }: Props) {
  return (
    <section className="flex flex-col gap-10">
      <SessionsListTabs />

      <SessionsListTable userId={userId} />
    </section>
  );
}
