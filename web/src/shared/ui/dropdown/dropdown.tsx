"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

import clsx from "clsx";

interface DropdownProps {
  trigger: (open: boolean) => ReactNode;
  children: ReactNode;
  className?: string;
}

export function Dropdown({ trigger, children, className }: DropdownProps) {
  const [open, setOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <div className="cursor-pointer" onClick={() => setOpen((prev) => !prev)}>
        {trigger(open)}
      </div>

      <div
        className={clsx(
          `
          absolute
          left-0
          top-full
          z-50
          mt-3
          min-w-[240px]
          overflow-hidden
          rounded-xl
          border
          border-(--primary-border)
          bg-(--color-neutral-500)
          shadow-lg
          transition-all
          duration-200
          `,
          open
            ? `
              visible
              translate-y-0
              opacity-100
            `
            : `
              invisible
              -translate-y-2
              opacity-0
            `,
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
