import { Typography } from "@/shared/";

interface Props {
  session: string;
}

export default function SessionOverview({ session }: Props) {
  return (
    <>
      <Typography variant="h1">Session {session}</Typography>
      <div className="flex pt-[10px] items-center gap-3 [&>*:not(:last-child)]:after:content-['·'] [&>*:not(:last-child)]:after:ml-3 [&>*:not(:last-child)]:after:text-(--table-meta-text)">
        <Typography variant="body">July 15, 2023</Typography>
        <Typography variant="body">10:00.23</Typography>
        <Typography variant="body">2h 00m 23s</Typography>
      </div>
    </>
  );
}
