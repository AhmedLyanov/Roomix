import { Typography } from "@/shared";

export function SessionsListTabs() {
  return (
    <div className="flex items-center gap-20.5">
      <button
        type="button"
        className="
          relative 
          after:absolute
          after:bottom-0
          after:left-0
          after:h-0.5
          after:w-full
          after:bg-(--table-chapter-active)
          after:content-['']
        "
      >
        <Typography variant="label" className="font-bold">
          Journal of sessions
        </Typography>
      </button>

      <button type="button">
        <Typography
          variant="label"
          className="font-bold text-(--table-chapter) "
        >
          Scheduled
        </Typography>
      </button>
    </div>
  );
}
