"use client";

import { useState } from "react";
import { Typography } from "@/src/shared";
import { ShareIcon } from "@/src/shared/icons/24";

interface ShareLinkProps {
  link?: string;
}

export function ShareLink({
  link = typeof window !== "undefined"
    ? window.location.href
    : "invite://merriweather.app",
}: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="
        flex
        items-center
        px-4
        py-3
        h-14
        bg-(--room-link)
        rounded-[17px]
        transition-all
        duration-200
        hover:opacity-90
        active:scale-[0.98]
      "
    >
      <div className="flex items-center gap-2 select-none">
        <ShareIcon />

        <Typography
          variant="body"
          className="text-(--color-gray-light) whitespace-nowrap"
        >
          {copied ? "Copied!" : "Share link:"}
        </Typography>
      </div>

      <div className="ml-1.25 mr-2.5 h-10 w-px bg-(--color-gray)" />

      <Typography
        variant="body"
        className="
          text-(--color-gray-light)
          truncate
          max-w-65
        "
      >
        {link}
      </Typography>
    </button>
  );
}
