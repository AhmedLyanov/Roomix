import { ReactNode } from "react";
import clsx from "clsx";

import { Typography } from "../typography/typography";

type ButtonVariant = "ghost" | "primary" | "secondary" | "control" | "danger";

interface ButtonProps {
  children?: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  badge?: boolean;
}

export function Button({
  children,
  icon,
  variant = "ghost",
  className = "",
  onClick,
  disabled = false,
  type = "button",
  badge = false,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        `
        relative
        group
        flex
        items-center
        justify-center
        gap-3
        transition-all
        duration-200

        disabled:cursor-not-allowed
        disabled:opacity-50
        `,

        variant === "danger" &&
          `
          h-16
          w-16
          rounded-[17px]

          bg-(--color-close-conference)

          hover:opacity-90
          `,

        variant === "ghost" &&
          `
          w-full
          rounded-lg
          px-3.5
          py-3.75

          hover:bg-(--button-hover-bg)
          `,

        variant === "primary" &&
          `
          w-fit
          rounded-lg
          px-8
          py-3.5

          bg-(--button-primary-bg)

          hover:bg-(--button-primary-bg-hover)
          `,

        variant === "secondary" &&
          `
          w-full
          rounded-xl
          border
          border-(--primary-border)
          px-6
          py-4

          bg-(--color-surface-contrast)

          hover:bg-(--button-hover-bg)
          `,

        variant === "control" &&
          `
          h-11.25
          w-11.25
          rounded-full

          bg-(--color-neutral-500)

          hover:opacity-80
          `,

        className,
      )}
    >
      {icon && (
        <span
          className={clsx(
            `
            flex-shrink-0
            transition-colors
            duration-200
            `,

            variant === "ghost" &&
              `
              text-(--color-gray)
              group-hover:text-(--color-foreground)
              `,

            variant === "primary" &&
              `
              text-(--button-primary-text)
              `,

            variant === "secondary" &&
              `
              text-(--color-gray-light)
              group-hover:text-(--color-foreground)
              `,

            variant === "control" &&
              `
              text-(--color-gray-light)
              group-hover:text-(--color-foreground)
              `,
          )}
        >
          {icon}
        </span>
      )}

      {children && (
        <Typography
          variant={
            variant === "primary" || variant === "secondary"
              ? "navigation"
              : "body"
          }
          className={clsx(
            `
            transition-colors
            duration-200
            `,

            variant === "ghost" &&
              `
              font-bold
              text-(--color-gray)
              group-hover:text-(--color-foreground)
              `,

            variant === "primary" &&
              `
              text-(--button-primary-text)
              `,

            variant === "secondary" &&
              `
              text-(--color-foreground)
              `,

            variant === "control" &&
              `
              text-(--color-gray-light)
              `,
          )}
        >
          {children}
        </Typography>
      )}

      {badge && (
        <span
          className="
            absolute
            top-2.5
            right-2.5
            h-2
            w-2
            rounded-full
            bg-red-500
          "
        />
      )}
    </button>
  );
}
