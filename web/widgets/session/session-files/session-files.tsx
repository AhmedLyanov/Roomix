import { Typography } from "@/shared";

import { FileItem } from "@/entities/file";

import { mockFiles } from "./model/mock-files";

export default function SessionFiles() {
  return (
    <div className="rounded-lg bg-(--table-meta-bg) p-5">
      <Typography variant="caption" className="mb-5 text-[17px]">
        Files ({mockFiles.length})
      </Typography>

      <div className="flex flex-col gap-2">
        {mockFiles.map((file) => (
          <FileItem key={file.id} file={file} />
        ))}
      </div>
    </div>
  );
}
