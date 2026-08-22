import { SessionsListTabs } from "../session-list-tabs/sessions-list-tabs";
import { SessionsListTable } from "../sessions-list-table/sessions-list-table";

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
