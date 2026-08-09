"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Typography } from "@/src/shared";

export function ThemeSwitch() {
  const [mounted, setMounted] = useState(false);

  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex w-[200px] rounded-xl bg-(--theme-switch-bg) p-1">
        <div className="h-9 flex-1 rounded-lg" />
        <div className="h-9 flex-1 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex w-[200px] rounded-xl bg-(--theme-switch-bg) p-1">
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={clsx(
          "flex flex-1 items-center justify-center rounded-lg py-2 transition-all duration-200",
          resolvedTheme === "dark" && "bg-(--theme-switch-active)",
        )}
      >
        <Typography
          variant="caption"
          className={clsx(
            "transition-colors duration-200",
            resolvedTheme === "dark"
              ? "text-(--theme-switch-text-active)"
              : "text-(--theme-switch-text)",
          )}
        >
          Dark
        </Typography>
      </button>

      <button
        type="button"
        onClick={() => setTheme("light")}
        className={clsx(
          "flex flex-1 items-center justify-center rounded-lg py-2 transition-all duration-200",
          resolvedTheme === "light" && "bg-(--theme-switch-active)",
        )}
      >
        <Typography
          variant="caption"
          className={clsx(
            "transition-colors duration-200",
            resolvedTheme === "light"
              ? "text-(--theme-switch-text-active)"
              : "text-(--theme-switch-text)",
          )}
        >
          Light
        </Typography>
      </button>
    </div>
  );
}
