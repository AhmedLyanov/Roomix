import { Typography } from "@/shared";

export default function ParticipantItem() {
  return (
    <article className="flex gap-3 items-center rounded-lg bg-(--table-meta-bg)  py-3">
      <div className="w-10 h-10 rounded-full bg-red-500"></div>
      <Typography variant="caption" className="text-[18px]">
        Lyanov Ahmed
      </Typography>
    </article>
  );
}
