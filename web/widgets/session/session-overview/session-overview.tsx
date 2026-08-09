import { Typography } from "@/shared/";

interface Props {
  session: string;
}

export default function SessionOverview({ session }: Props) {
  return (
    <>
      <Typography variant="h1">Session {session}</Typography>
    </>
  );
}
