import { Typography } from "@/shared";

interface SessionModeCardProps {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
}

export function SessionModeCard({
  icon,
  title,
  onClick,
}: SessionModeCardProps) {
  return (
    <button
      onClick={onClick}
      className="
        group
        relative
        flex
        h-52.5
        w-full
        flex-col
        items-center
        justify-center
        gap-6
        overflow-hidden
        rounded-[20px]
        border-0
        outline-none
        bg-(--session-card-bg)
        shadow-(--session-card-shadow)
        duration-300
        hover:cursor-pointer
      "
    >
      <div
        className="absolute inset-0 rounded-[20px] p-[1.11px] pointer-events-none"
        style={{
          background: "var(--session-card-border-gradient)",
        }}
      >
        <div className="h-full w-full rounded-[19px] bg-(--session-card-bg) " />
      </div>

      <div className="absolute -top-10 -left-10 h-32 w-32 rounded-full blur-2xl pointer-events-none bg-(--session-card-glow)" />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {icon}
        <Typography variant="label" className="text-foreground">
          {title}
        </Typography>
      </div>
    </button>
  );
}
