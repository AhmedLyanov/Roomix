import { Typography } from "../typography/typography";

interface Props {
  badge: string;
}

export function Badge({ badge }: Props) {
  return (
    <div className="inline-flex items-center rounded-full bg-(--color-surface-strong) px-3 py-2">
      <Typography variant="caption" className="text-(--color-gray) text-xs">
        {badge}
      </Typography>
    </div>
  );
}
