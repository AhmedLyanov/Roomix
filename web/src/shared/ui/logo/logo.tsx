import { Typography } from "../typography/typography";
import { LogoIcon } from "@/src/shared/icons/24";

export function Logo() {
  return (
    <div className="flex items-center gap-2.25">
      <LogoIcon />
      <Typography variant="body" className="text-(--color-logo)">
        Roomix
      </Typography>
    </div>
  );
}
