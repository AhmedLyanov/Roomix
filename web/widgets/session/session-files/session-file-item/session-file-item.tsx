import { Typography } from "@/shared";
import { DownloadIcon } from "@/shared/icons/24";

export default function SessionFile() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-(--table-meta-bg)" />
        <div>
          <Typography variant="caption" className="text-[18px]">
            design-system.pdf
          </Typography>
          <div className="flex items-center gap-3">
            <Typography variant="body" className="text-[15px]">
              PDF
            </Typography>
            <Typography variant="body" className="text-[15px]">
              1.1 MB
            </Typography>
            <Typography variant="body" className="text-[15px]">
              01:56 AM
            </Typography>
          </div>
        </div>
      </div>
      <div className="text-(--color-gray-light)">
        <DownloadIcon />
      </div>
    </div>
  );
}
