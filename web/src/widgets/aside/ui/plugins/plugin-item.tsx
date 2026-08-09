import { ChevronRight } from "lucide-react";
import clsx from "clsx";

import { Typography } from "@/src/shared";

type PluginItemProps = {
  title: string;
  active?: boolean;
  onClick?: () => void;
};

export default function PluginItem({
  title,
  active = false,
  onClick,
}: PluginItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group
        flex w-full items-center justify-between
        pl-[45px]
      "
    >
      <Typography
        variant="body"
        className={clsx(
          `
          font-normal
          transition-colors duration-200
          `,
          active
            ? "text-(--color-foreground)"
            : "text-(--color-gray) group-hover:text-(--color-foreground)",
        )}
      >
        {title}
      </Typography>

      <ChevronRight
        size={22}
        className={clsx(
          `
          transition-colors duration-200
          `,
          active
            ? "text-(--color-foreground)"
            : "text-(--color-gray) group-hover:text-(--color-foreground)",
        )}
      />
    </button>
  );
}
