import { Typography } from "@/shared/";
import SessionFileItem from "./session-file-item/session-file-item";
export default function SessionFiles() {
  return (
    <div className="rounded-lg bg-(--table-meta-bg) p-5">
      <Typography variant="caption" className="text-[17px]">
        Files (5)
      </Typography>
      <div className="">
        <SessionFileItem />
      </div>
    </div>
  );
}
